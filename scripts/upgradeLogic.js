const { ethers, upgrades } = require("hardhat");

async function main() {
  const existingProxyAddr = "0x127C6c6fD93c9092ef84a4900c4c889f4218cC34"; // deployed proxy address
  const NewVault = await ethers.getContractFactory("WalletLogic"); // updated code!
  const upgraded = await upgrades.upgradeProxy(existingProxyAddr, NewVault);
  await upgraded.waitForDeployment();
  console.log("WalletLogic upgraded at proxy address:",await upgraded.getAddress());
  console.log("Implementation address:", await upgrades.erc1967.getImplementationAddress(await upgraded.getAddress()));
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});