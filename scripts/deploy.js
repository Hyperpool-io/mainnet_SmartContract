const { ethers, upgrades } = require("hardhat");

async function main() {
  [admin] = await ethers.getSigners();

  // Deploy WalletLogic
  const WalletLogic = await ethers.getContractFactory("WalletLogic");
  const walletLogic = await upgrades.deployProxy(WalletLogic, [admin.address, admin.address], { initializer: "initialize" });
  await walletLogic.waitForDeployment();
  const impllogic = await upgrades.erc1967.getImplementationAddress(await walletLogic.getAddress());

  // Deploy AggregatorManager
  const AggregatorManager = await ethers.getContractFactory("AggregatorManager");
  const aggregatorMgr = await upgrades.deployProxy(
    AggregatorManager,
    ["0x2791bca1f2de4661ed88a30c99a7a9449aa84174","0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39", impllogic, "0xC36442b4a4522E871399CD717aBDD847Ab11FE88", "0xE592427A0AEce92De3Edee1F18E0157C05861564","0x454545230d2ca1e2449816bf339d1103b8c282a3"],
    { initializer: "initialize" }
  );
  await aggregatorMgr.waitForDeployment();
  const implAddr = await upgrades.erc1967.getImplementationAddress(await walletLogic.getAddress());
  console.log("WalletLogic (Proxy):", await walletLogic.getAddress());
  console.log("WalletLogic (Implementation):", impllogic);
  console.log("AggregatorManager (Proxy):", await aggregatorMgr.getAddress());
  console.log("AggregatorManager (Implementation):", implAddr);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });