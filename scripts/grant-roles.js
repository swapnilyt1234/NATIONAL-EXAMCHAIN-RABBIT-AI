import { network } from "hardhat";

const { ethers } = await network.connect();

function parseAddresses(value) {
  if (!value) return [];

  return value
    .split(",")
    .map((address) => address.trim())
    .filter((address) => address.length > 0);
}

async function grantRoleIfNeeded(contract, role, wallet, roleName) {
  if (!ethers.isAddress(wallet)) {
    throw new Error(`Invalid ${roleName} wallet address: ${wallet}`);
  }

  const hasRole = await contract.hasRole(role, wallet);
  if (hasRole) {
    console.log(`Skipping ${roleName} role for ${wallet} (already granted)`);
    return;
  }

  const tx = await contract.grantRole(role, wallet);
  console.log(`Granting ${roleName} role to ${wallet}... tx: ${tx.hash}`);
  await tx.wait();
  console.log(`Granted ${roleName} role to ${wallet}`);
}

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress || !ethers.isAddress(contractAddress)) {
    throw new Error("Set a valid CONTRACT_ADDRESS in your environment.");
  }

  const adminWallets = parseAddresses(process.env.ADMIN_WALLETS || process.env.TEACHER_WALLETS);
  const examCenterWallets = parseAddresses(
    process.env.EXAM_CENTER_WALLETS || process.env.STUDENT_WALLETS,
  );
  const studentWallets = parseAddresses(process.env.STUDENT_WALLETS);

  if (adminWallets.length === 0 && examCenterWallets.length === 0 && studentWallets.length === 0) {
    throw new Error(
      "Provide ADMIN_WALLETS and/or EXAM_CENTER_WALLETS and/or STUDENT_WALLETS (or legacy TEACHER_WALLETS/STUDENT_WALLETS).",
    );
  }

  const contract = await ethers.getContractAt("EduAccessControl", contractAddress);

  const ADMIN_ROLE = await contract.ADMIN_ROLE();
  const EXAM_CENTER_ROLE = await contract.EXAM_CENTER_ROLE();
  const STUDENT_ROLE = await contract.STUDENT_ROLE();

  for (const wallet of adminWallets) {
    await grantRoleIfNeeded(contract, ADMIN_ROLE, wallet, "ADMIN");
  }

  for (const wallet of examCenterWallets) {
    await grantRoleIfNeeded(contract, EXAM_CENTER_ROLE, wallet, "EXAM_CENTER");
  }

  for (const wallet of studentWallets) {
    await grantRoleIfNeeded(contract, STUDENT_ROLE, wallet, "STUDENT");
  }

  console.log("Role bootstrap complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
