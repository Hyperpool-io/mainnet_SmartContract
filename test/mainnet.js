const { ethers, network } = require("hardhat");

const WALLET_LOGIC_ADDRESS = "0x5F9fac483068e30d19DBd1BD765Cf28e8bEdAb81";
const UNIV3_NFT_MANAGER_ADDRESS = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
const TOKEN_ID = 2579067;

async function main() {
    // 1. Get contract instances
    const walletLogic = await ethers.getContractAt("WalletLogic", WALLET_LOGIC_ADDRESS);
    const nftManager = await ethers.getContractAt("IUniV3LiquidityProtocol", UNIV3_NFT_MANAGER_ADDRESS);

    // 2. Get owner/aggregatorManager
    const owner = await walletLogic.owner();
    const aggregator = await walletLogic.aggregatorManager();
    console.log("WalletLogic owner:", owner);
    console.log("WalletLogic aggregatorManager:", aggregator);


    const signer = await ethers.getSigner(owner);

    // 4. Check NFT owner
    const nftOwner = await nftManager.ownerOf(TOKEN_ID);
    console.log("NFT owner:", "0x5F9fac483068e30d19DBd1BD765Cf28e8bEdAb81");

    // 5. Check WalletLogic's lpTokenId
    const Aliquidity = "53507116568";
    const lpTokenId = await walletLogic.positionTokenId();
    console.log("WalletLogic lpTokenId:", lpTokenId.toString());

    // 6. Check position details
    const [operator, token0, token1, liquidity, tokensOwed0, tokensOwed1] =
        await walletLogic.connect(signer).getPositionDetails(UNIV3_NFT_MANAGER_ADDRESS);
    console.log("Operator:", operator);
    console.log("Token0:", token0);
    console.log("Token1:", token1);
    console.log("Liquidity:", liquidity.toString());
    console.log("TokensOwed0:", tokensOwed0.toString());
    console.log("TokensOwed1:", tokensOwed1.toString());

    // 7. Check raw Uniswap position
    const pos = await nftManager.positions(TOKEN_ID);
    console.log("Uniswap position liquidity:", pos.liquidity.toString());
    try {
        const walletLogicSigner = await ethers.getSigner(WALLET_LOGIC_ADDRESS);

        const deadline = Math.floor(Date.now() / 1000) + 10_000_000;
        await nftManager.connect(walletLogicSigner).decreaseLiquidity(
            TOKEN_ID,
            liquidity,
            0,
            0,
            deadline
        );
    } catch (err) {
        console.error("Direct decreaseLiquidity failed:", err);
    }

    // try {
    //     const tx = await walletLogic.connect(signer).withdrawFromProtocol(
    //         UNIV3_NFT_MANAGER_ADDRESS,
    //         Aliquidity,
    //         owner // send tokens to owner
    //     );
    //     const receipt = await tx.wait();
    //     console.log("Withdraw successful, tx:", receipt.transactionHash);
    // } catch (err) {
    //     // Print revert reason if available
    //     if (err.error && err.error.data && err.error.data.message) {
    //         console.error("Withdraw failed with reason:", err.error.data.message);
    //     } else if (err.reason) {
    //         console.error("Withdraw failed with reason:", err.reason);
    //     } else if (err.data && err.data.message) {
    //         console.error("Withdraw failed with reason:", err.data.message);
    //     } else {
    //         console.error("Withdraw failed:", err);
    //     }
    // }
}

main().catch(console.error);