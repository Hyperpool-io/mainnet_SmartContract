// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IUniV3LiquidityProtocol.sol";

contract WalletLogic is Initializable, OwnableUpgradeable {
    address public aggregatorManager;
    uint256 public lpTokenId;

    function initialize(address _owner, address _agg) public initializer {
        __Ownable_init(_owner);
        aggregatorManager = _agg;
    }

    modifier onlyAggregator() {
        require(
            msg.sender == aggregatorManager || msg.sender == owner(),
            "AGGREGATOR_ONLY"
        );
        _;
    }

    function supplyToProtocol(
        address univ3NFTManager,
        IUniV3LiquidityProtocol.MintParams calldata params
    )
        external
        onlyAggregator
        returns (uint256 tokenId, uint256 amount0, uint256 amount1)
    {
        IERC20(params.token0).approve(univ3NFTManager, params.amount0Desired);
        IERC20(params.token1).approve(univ3NFTManager, params.amount1Desired);

        (tokenId, , amount0, amount1) = IUniV3LiquidityProtocol(univ3NFTManager)
            .mint(params);

        lpTokenId = tokenId;
    }

    function withdrawFromProtocol(
        address univ3NFTManager,
        uint128 liquidity,
        address to
    ) external onlyAggregator returns (uint256 amt0, uint256 amt1) {
        require(lpTokenId != 0, "No position");
        IUniV3LiquidityProtocol.DecreaseLiquidityParams
            memory params = IUniV3LiquidityProtocol.DecreaseLiquidityParams(
                lpTokenId,
                liquidity,
                0,
                0,
                block.timestamp + 10 minutes
            );

        (amt0, amt1) = IUniV3LiquidityProtocol(univ3NFTManager).decreaseLiquidity(params);
        IUniV3LiquidityProtocol.CollectParams
            memory paramsCollect = IUniV3LiquidityProtocol.CollectParams(
                lpTokenId,
                to,
                type(uint128).max,
                type(uint128).max
            );
        (amt0, amt1) = IUniV3LiquidityProtocol(univ3NFTManager).collect(paramsCollect);
        lpTokenId = 0;
    }

    function getPositionDetails(
        address univ3NFTManager
    )
        external
        view
        returns (
            address operator,
            address token0,
            address token1,
            uint128 liquidity,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        )
    {
        if (lpTokenId == 0) {
            return (address(0), address(0), address(0), 0, 0, 0);
        }
        (
            ,
            operator,
            token0,
            token1,
            ,
            ,
            ,
            liquidity,
            ,
            ,
            tokensOwed0,
            tokensOwed1
        ) = IUniV3LiquidityProtocol(univ3NFTManager).positions(lpTokenId);
    }

    function positionTokenId() public view returns (uint256) {
        return lpTokenId;
    }
    function rescueToken(address token, address to) external onlyAggregator {
        uint256 amount = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(to, amount);
    }
    function transferLiquidityNFT(
        address univ3NFTManager,
        uint256 tokenId
    ) external onlyAggregator {
        // Transfers the NFT from this contract to recipient
        IUniV3LiquidityProtocol(univ3NFTManager).safeTransferFrom(
            address(this),
            owner(),
            tokenId
        );
    }
}
