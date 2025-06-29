const { ethers, upgrades } = require("hardhat");

async function main() {
  const existingProxyAddr = "0x572Dff67c76C167a0F13639Fd1Bd0909BAa244e4"; // deployed proxy address
  const NewVault = await ethers.getContractFactory("AggregatorManager"); // updated code!
  const upgraded = await upgrades.upgradeProxy(existingProxyAddr, NewVault);
  await upgraded.waitForDeployment();
  console.log("AggregatorManager upgraded at proxy address:",await upgraded.getAddress());
  console.log("Implementation address:", await upgrades.erc1967.getImplementationAddress(await upgraded.getAddress()));
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});