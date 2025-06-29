const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Aggregator/UniswapV3 End2End with Router", function () {
  let usdc, token1, token2, nftManager, walletLogic, AggregatorManager, admin, user1, aggregatorMgr, router;

  beforeEach(async () => {
    [admin, user1] = await ethers.getSigners();

    // Deploy tokens
    const USDC = await ethers.getContractFactory("MockUSDC");
    usdc = await USDC.deploy();
    await usdc.waitForDeployment();

    const Token1 = await ethers.getContractFactory("MockToken1");
    token1 = await Token1.deploy();
    await token1.waitForDeployment();

    const Token2 = await ethers.getContractFactory("MockToken1");
    token2 = await Token2.deploy();
    await token2.waitForDeployment();

    // Mint to user1
    await usdc.mint(user1.address, "200000000"); // 200 USDC.e
    await token1.mint(user1.address, ethers.parseUnits("200", 18));
    await token2.mint(admin.address, ethers.parseUnits("200", 18));

    // Deploy MockUniswapV3NFTManager
    const MockV3 = await ethers.getContractFactory("MockUniV3NFTManager");
    nftManager = await MockV3.deploy();
    await nftManager.waitForDeployment();

    // Deploy Router
    const Router = await ethers.getContractFactory("MockRouter");
    router = await Router.deploy();
    await router.waitForDeployment();

    // Set router prices
    await router.setPrice(await usdc.getAddress(), await token1.getAddress(), ethers.parseUnits("2", 18));
    await router.setPrice(await token1.getAddress(), await usdc.getAddress(), ethers.parseUnits("0.5", 18));
    await router.setPrice(await usdc.getAddress(), await token2.getAddress(), ethers.parseUnits("2", 18));
    await router.setPrice(await token2.getAddress(), await usdc.getAddress(), ethers.parseUnits("0.5", 18));

    // Mint token1 to router so it can send out token1 on swap
    await token1.mint(await router.getAddress(), ethers.parseUnits("1000", 18));
    // Mint token2 to router for restake
    await token2.mint(await router.getAddress(), ethers.parseUnits("1000", 18));

    // Deploy WalletLogic
    const WalletLogic = await ethers.getContractFactory("WalletLogic");
    walletLogic = await upgrades.deployProxy(WalletLogic, [admin.address, admin.address], { initializer: "initialize" });
    await walletLogic.waitForDeployment();
    const implAddr = await upgrades.erc1967.getImplementationAddress(await walletLogic.getAddress());

    // Deploy AggregatorManager
    AggregatorManager = await ethers.getContractFactory("AggregatorManager");
    aggregatorMgr = await upgrades.deployProxy(
      AggregatorManager,
      [await usdc.getAddress(), implAddr, await nftManager.getAddress(), await router.getAddress()],
      { initializer: "initialize" }
    );
    await aggregatorMgr.waitForDeployment();
    console.log(await aggregatorMgr.getAddress());

    // Approvals to aggregator
    await usdc.connect(user1).approve(await aggregatorMgr.getAddress(), ethers.parseUnits("1000", 6));
    await token1.connect(user1).approve(await aggregatorMgr.getAddress(), ethers.parseUnits("1000", 18));
    await token2.connect(admin).approve(await aggregatorMgr.getAddress(), ethers.parseUnits("1000", 18));
  });

  it("User deposit, LP NFT mint, withdraw and restake with router", async () => {
    // User1 deposits 100 USDC, manager splits and swaps via router
    await aggregatorMgr.connect(user1).deposit(
      ethers.parseUnits("100", 6),
      await usdc.getAddress(),
      await token1.getAddress(),
      500, 0, 0
    );
    const userWallets = await aggregatorMgr.getUserWallets(user1.address);
    expect(userWallets.length).to.equal(1);

    const mappingWallet = userWallets[0].proxy;
    const wallet = await ethers.getContractAt("WalletLogic", mappingWallet);
    const tokenId = await wallet.positionTokenId();
    console.log(tokenId.toString());

    // We'll mint a position with some liquidity and owed tokens
    // await nftManager.mintPosition(
    //   mappingWallet,
    //   await usdc.getAddress(),
    //   await token1.getAddress(),
    //   500, 0, 0,
    //   ethers.parseUnits("50", 6), // amount0
    //   ethers.parseUnits("50", 18), // amount1
    //   tokenId // use the same tokenId as in WalletLogic
    // );

    // // Fund the NFT manager with a large amount so it can pay out collect() calls
    // await usdc.mint(await nftManager.getAddress(), ethers.parseUnits("1000000", 6));
    // await token1.mint(await nftManager.getAddress(), ethers.parseUnits("1000000", 18));

    // Withdraw
    await aggregatorMgr.connect(user1).withdraw(user1.address, 0);
    expect(Number(await usdc.balanceOf(user1.address))).to.be.greaterThan(0);

    // Admin restakes to token2
    // Mint a new position for the mapping wallet with token2 for restake
    // First, mint token2 to mapping wallet so it can receive it
    // await token2.mint(mappingWallet, ethers.parseUnits("100", 18));
    // Mint a new position for token2
    // await nftManager.mintPosition(
    //   mappingWallet,
    //   await usdc.getAddress(),
    //   await token2.getAddress(),
    //   500, 0, 0,
    //   ethers.parseUnits("50", 6), // amount0
    //   ethers.parseUnits("100", 18), // amount1
    //   tokenId + 1 // new tokenId for restake
    // );
    await aggregatorMgr.connect(user1).deposit(
      ethers.parseUnits("100", 6),
      await usdc.getAddress(),
      await token1.getAddress(),
      500, 0, 0
    );

    await aggregatorMgr.connect(admin).restake(
      user1.address, 1, await token2.getAddress(), 500, 0, 0
    );
    const userWallets2 = await aggregatorMgr.getUserWallets(user1.address);
    expect(userWallets2[1].token1).to.equal(await token2.getAddress());
  });
});