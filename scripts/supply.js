require("dotenv").config();
const { ethers } = require("hardhat");

const POOL = "0xa4d94019934d8333ef880abffbf2fdd611c762bd";
const USDC = "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359";

const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)"
];

const POOL_ABI = [
  "function supply(address asset,uint256 amount,address onBehalfOf,uint16 referralCode) external"
];

async function main() {
  const [signer] = await ethers.getSigners();

  // 1. Check USDC balance
  const usdc = new ethers.Contract(USDC, USDC_ABI, signer);
  const balance = await usdc.balanceOf(signer.address);
  console.log("USDC balance:", ethers.formatUnits(balance, 6));

  // 2. Set amount to supply (e.g., 1 USDC)
  const amount = ethers.parseUnits("1", 6);

  if (BigInt(balance) < BigInt(amount)) {
    throw new Error("Not enough USDC balance");
  }

  // 3. Approve if needed
  const allowance = await usdc.allowance(signer.address, POOL);
  if (BigInt(allowance) < BigInt(amount)) {
    const tx1 = await usdc.approve(POOL, amount);
    await tx1.wait();
    console.log("Approved USDC for AAVE Pool");
  } else {
    console.log("Sufficient allowance already set");
  }

  // 4. Supply USDC to AAVE
  const pool = new ethers.Contract(POOL, POOL_ABI, signer);
  const tx2 = await pool.supply(USDC, amount, signer.address, 0);
  await tx2.wait();
  console.log("Supplied USDC to AAVE V3 Pool!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});