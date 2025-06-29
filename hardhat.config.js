require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // <--- THIS LINE
    },
  },

  networks: {

    hardhat: {
      forking: {
        url: "https://arbitrum-mainnet.infura.io/v3/a364b3c14ec24d67a8d260b721adb45b",
      }
    },
    testnet: {
      url: "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: [process.env.PRIVATE_KEY],
    },
    polygon: {
      url: "https://polygon-bor-rpc.publicnode.com",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 137
    },
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY,
      polygon: process.env.POLYGONSCAN_API_KEY, // PolygonScan
    },
  },
};
