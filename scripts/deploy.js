import { network } from "hardhat";

const { ethers } = await network.connect();

function normalizePrivateKey(privateKey) {
  if (!privateKey) return undefined;

  const trimmed = String(privateKey).trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) return undefined;

  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return /^0x[0-9a-fA-F]{64}$/.test(prefixed) ? prefixed : undefined;
}

async function main() {
  const signers = await ethers.getSigners();

  let deployer;

  if (signers.length) {
    [deployer] = signers;
  } else {
    const normalizedPrivateKey = normalizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
    if (!normalizedPrivateKey) {
      throw new Error(
        "No deployer signer available. Set valid DEPLOYER_PRIVATE_KEY in .env.local and retry.",
      );
    }

    deployer = new ethers.Wallet(normalizedPrivateKey, ethers.provider);
  }

  console.log(`Deploying EduAccessControl with deployer: ${deployer.address}`);

  const factory = await ethers.getContractFactory("EduAccessControl", deployer);
  const deployTxRequest = await factory.getDeployTransaction(deployer.address);

  const estimatedGas = await deployer.estimateGas(deployTxRequest);
  const gasLimit = (estimatedGas * 12n) / 10n;

  // Keep deployment fees below restrictive RPC caps while staying above chain minimum tips.
  const maxPriorityFeePerGas = 30_000_000_000n; // 30 gwei
  const maxFeePerGas = 60_000_000_000n; // 60 gwei

  const contract = await factory.deploy(deployer.address, {
    gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
  });
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`EduAccessControl deployed at: ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});