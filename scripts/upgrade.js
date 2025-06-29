const { ethers, upgrades } = require("hardhat");

async function main() {
  const existingProxyAddr = "0xA8f3b11e140262135949fbd85329668B4d655C6e"; // deployed proxy address
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