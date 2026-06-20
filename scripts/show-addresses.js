import { network } from "hardhat";

const { ethers } = await network.connect();

function parseAddresses(value) {
  if (!value) return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function printAddressList(label, addresses) {
  if (addresses.length === 0) {
    console.log(`${label}: (none)`);
    return;
  }

  console.log(`${label}:`);
  for (const address of addresses) {
    const valid = ethers.isAddress(address);
    console.log(`  - ${address} ${valid ? "" : "(INVALID)"}`.trimEnd());
  }
}

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const frontendAddress = process.env.NEXT_PUBLIC_EDU_CONTRACT_ADDRESS;

  if (privateKey) {
    try {
      const wallet = new ethers.Wallet(privateKey);
      console.log(`Deployer address (from DEPLOYER_PRIVATE_KEY): ${wallet.address}`);
    } catch {
      console.log("Deployer address: DEPLOYER_PRIVATE_KEY is invalid");
    }
  } else {
    console.log("Deployer address: DEPLOYER_PRIVATE_KEY not set");
  }

  console.log(`CONTRACT_ADDRESS: ${contractAddress || "(not set)"}`);
  console.log(`NEXT_PUBLIC_EDU_CONTRACT_ADDRESS: ${frontendAddress || "(not set)"}`);

  printAddressList(
    "Admin wallets",
    parseAddresses(process.env.ADMIN_WALLETS || process.env.TEACHER_WALLETS),
  );
  printAddressList(
    "Examination centre wallets",
    parseAddresses(process.env.EXAM_CENTER_WALLETS || process.env.STUDENT_WALLETS),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
