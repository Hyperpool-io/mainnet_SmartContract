// scripts/verify-impl.js
const { upgrades } = require("hardhat");
const hre = require("hardhat");


async function main() {
    const usdcAddress = "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359";      // put real address on testnet/net
  const treasury = "0x454545230d2ca1e2449816bf339d1103b8c282a3";
  const protocol = "0xa4d94019934d8333ef880abffbf2fdd611c762bd";  
  const proxyAddress = "0x5A0E898233fc15cFeA2995ddD0E62E5ce1d6a127"; // Your proxy address
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("Implementation Address:", implAddress);

  // No constructor args for implementation
  await hre.run("verify:verify", {
    address: implAddress,
    constructorArguments: [],
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
