// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./WalletLogic.sol";
import "./IUniV3LiquidityProtocol.sol";
import "./ISwapRouter.sol";

abstract contract ReentrancyGuard is Initializable {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;
    function __ReentrancyGuard_init() internal onlyInitializing {
        _status = _NOT_ENTERED;
    }
    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
    modifier isHuman() {
        require(tx.origin == msg.sender, "sorry humans only");
        _;
    }
}

contract AggregatorManager is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;
    address public logicImplementation;
    address public usdc;
    address public pairToken;
    address public univ3NFTManager;
    address public router;
    address public treasury;
    mapping(address => uint256) public initialDeposits;

    bool public active;
    struct UserWalletInfo {
        address proxy;
        uint256 tokenId;
        address token0;
        address token1;
        uint256 initialDeposit;
    }
    mapping(address => UserWalletInfo[]) public userWallets;
    mapping(address => bool) public walletExists;

    event Deposit(
        address indexed user,
        address mappingWallet,
        uint256 initialDeposit,
        uint256 tokenId
    );
    event Withdraw(
        address indexed user,
        address mappingWallet,
        uint256 amount0,
        uint256 amount1
    );
    event Swapped(
        address indexed user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    event LiquidityAdded(
        uint256 tokenId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    );
    event LiquidityRemoved(uint256 tokenId, uint256 amount0, uint256 amount1);

    function initialize(
        address _usdc,
        address _pairToken,
        address _logicImplementation,
        address _univ3NFTManager,
        address _router,
        address _treasury
    ) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        logicImplementation = _logicImplementation;
        usdc = _usdc;
        pairToken = _pairToken;
        univ3NFTManager = _univ3NFTManager;
        router = _router;
        treasury = _treasury;
        active = true;
    }
    receive() external payable {}

    modifier whenActive() {
        require(active == true, "Inactive");
        _;
    }

    function deposit(
        uint256 amount,
        address token0,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper
    ) external isHuman nonReentrant whenActive {
        require(token0 == usdc, "token0 must be USDC.e");
        IERC20(usdc).transferFrom(msg.sender, address(this), amount);
        // Swap half USDC.e to pairToken
        uint256 swapAmount = amount / 2;
        IERC20(usdc).approve(router, swapAmount);
        ISwapRouter.ExactInputSingleParams memory paramsSwap = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: usdc,
                tokenOut: pairToken,
                fee: fee,
                recipient: address(this),
                deadline: block.timestamp + 60,
                amountIn: swapAmount,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

        uint256 token1Received = ISwapRouter(router).exactInputSingle(
            paramsSwap
        );

        // Done: amtUSDC (left) + amtToken1 (swapped) are now contract's.
        emit Swapped(msg.sender, usdc, pairToken, swapAmount, token1Received);

        // Prepare mapping wallet
        address mappingWallet = Clones.clone(logicImplementation);
        WalletLogic(mappingWallet).initialize(owner(), address(this));

        // Transfer tokens to mapping wallet
        IERC20(token0).approve(mappingWallet, amount - swapAmount);
        IERC20(token0).transfer(mappingWallet, amount - swapAmount);
        IERC20(pairToken).approve(mappingWallet, token1Received);
        IERC20(pairToken).transfer(mappingWallet, token1Received);

        IUniV3LiquidityProtocol.MintParams
            memory params = IUniV3LiquidityProtocol.MintParams(
                token0,
                pairToken,
                fee,
                tickLower,
                tickUpper,
                amount - swapAmount,
                token1Received,
                0,
                0,
                mappingWallet,
                block.timestamp + 10 minutes
            );

        (uint256 tokenId, , ) = WalletLogic(mappingWallet).supplyToProtocol(
            univ3NFTManager,
            params
        );

        userWallets[msg.sender].push(
            UserWalletInfo(mappingWallet, tokenId, token0, pairToken, amount)
        );
        walletExists[mappingWallet] = true;
        uint256 initialDeposit = initialDeposits[msg.sender];
        initialDeposit += amount;
        initialDeposits[msg.sender] = initialDeposit;

        emit Deposit(msg.sender, mappingWallet, amount, tokenId);
    }

    function getUserWallets(
        address user
    ) external view returns (UserWalletInfo[] memory) {
        return userWallets[user];
    }

    function withdrawTotal(address user) external isHuman {
        UserWalletInfo[] storage wallets = userWallets[msg.sender];
        for (uint256 i = 0; i < wallets.length; i++) {
            UserWalletInfo storage info = wallets[i];
            WalletLogic logic = WalletLogic(info.proxy);
            (, , , uint128 liquidity, , ) = logic.getPositionDetails(
                univ3NFTManager
            );
            if (liquidity > 0) {
                withdraw(user, i);
            }
        }
    }

    function withdraw(
        address user,
        uint256 walletId
    ) public nonReentrant whenActive {
        require(user == msg.sender || msg.sender == owner(), "NOT_ALLOWED");
        UserWalletInfo storage info = userWallets[user][walletId];
        WalletLogic logic = WalletLogic(info.proxy);
        (, , , uint128 liquidity, , ) = logic.getPositionDetails(
            univ3NFTManager
        );

        (uint256 amt0, uint256 amt1) = logic.withdrawFromProtocol(
            univ3NFTManager,
            liquidity,
            address(this)
        );
        logic.rescueToken(usdc, address(this));
        logic.rescueToken(info.token1, address(this));
        amt0 = IERC20(usdc).balanceOf(address(this));
        amt1 = IERC20(info.token1).balanceOf(address(this));
        // Swap token1 to USDC.e
        IERC20(info.token1).approve(router, amt1);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: info.token1,
                tokenOut: usdc,
                fee: 10000,
                recipient: address(this),
                deadline: block.timestamp + 60,
                amountIn: amt1,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

        uint256 usdcReceived = ISwapRouter(router).exactInputSingle(params);

        emit Swapped(msg.sender, info.token1, usdc, amt1, usdcReceived);

        uint256 usdcTotal = amt0 + usdcReceived;
        uint256 profit = usdcTotal > info.initialDeposit
            ? usdcTotal - info.initialDeposit
            : 0;
        uint256 fee = (profit * 10) / 100;
        uint256 payout = usdcTotal - fee;
        if (fee > 0) IERC20(usdc).safeTransfer(treasury, fee);
        IERC20(usdc).safeTransfer(user, payout);
        initialDeposits[user] -= usdcTotal;

        emit Withdraw(user, info.proxy, amt0, amt1);
    }

    // OnlyOwner, restake: Withdraw -> Mint new LP in new protocol
    function restake(
        address user,
        uint256 walletId,
        address newToken1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper
    ) external onlyOwner {
        UserWalletInfo storage info = userWallets[user][walletId];
        WalletLogic logic = WalletLogic(info.proxy);

        // Remove all liquidity to AggregatorManager
        (uint256 amt0, uint256 amt1) = logic.withdrawFromProtocol(
            univ3NFTManager,
            type(uint128).max, // withdraw all
            address(this)
        );

        // Rescue tokens in wallet.
        logic.rescueToken(usdc, address(this));
        logic.rescueToken(info.token1, address(this));
        amt0 = IERC20(usdc).balanceOf(address(this));
        amt1 = IERC20(info.token1).balanceOf(address(this));
        // Swap token1 to USDC.e
        IERC20(info.token1).approve(router, amt1);

        ISwapRouter.ExactInputSingleParams memory paramsSwap1 = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: info.token1,
                tokenOut: usdc,
                fee: 10000,
                recipient: address(this),
                deadline: block.timestamp + 60,
                amountIn: amt1,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

        uint256 usdcReceived = ISwapRouter(router).exactInputSingle(
            paramsSwap1
        );
        uint256 totalUsdc = amt0 + usdcReceived;

        // Swap half USDC.e to newToken1
        uint256 swapAmount = totalUsdc / 2;
        IERC20(usdc).approve(router, swapAmount);

        ISwapRouter.ExactInputSingleParams memory paramsSwap = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: usdc,
                tokenOut: newToken1,
                fee: fee,
                recipient: address(this),
                deadline: block.timestamp + 60,
                amountIn: swapAmount,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

        uint256 newToken1Received = ISwapRouter(router).exactInputSingle(
            paramsSwap
        );

        // Transfer tokens to mapping wallet
        IERC20(usdc).approve(info.proxy, totalUsdc - swapAmount);
        IERC20(usdc).transfer(info.proxy, totalUsdc - swapAmount);
        IERC20(newToken1).approve(info.proxy, newToken1Received);
        IERC20(newToken1).transfer(info.proxy, newToken1Received);

        IUniV3LiquidityProtocol.MintParams
            memory params = IUniV3LiquidityProtocol.MintParams(
                usdc,
                newToken1,
                fee,
                tickLower,
                tickUpper,
                totalUsdc - swapAmount,
                newToken1Received,
                0,
                0,
                info.proxy,
                block.timestamp + 10 minutes
            );
        (uint256 tokenId, , ) = WalletLogic(info.proxy).supplyToProtocol(
            univ3NFTManager,
            params
        );
        info.token1 = newToken1;
        info.tokenId = tokenId;
    }
    function hasWallet(
        address user,
        uint256 walletId
    ) public view returns (bool) {
        return userWallets[user][walletId].proxy != address(0);
    }
    function getInitialDeposit(address user) external view returns (uint256) {
        return initialDeposits[user];
    }

    function setWalletImpAddress(address _impAddr) external onlyOwner {
        logicImplementation = _impAddr;
    }
    //change treasury wallet
    function changeTreasury(address newTresury) external onlyOwner {
        require(newTresury != treasury, "Same address ditected");
        treasury = newTresury;
    }

    function rescueToken(address token, address to) external onlyOwner {
        uint256 amount = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(to, amount);
    }
}
