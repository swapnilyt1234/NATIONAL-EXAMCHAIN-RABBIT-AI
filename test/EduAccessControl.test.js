import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("EduAccessControl", function () {
  async function deployFixture() {
    const [admin, teacher1, teacher2, student, outsider] = await ethers.getSigners();
    const contract = await ethers.deployContract("EduAccessControl", [admin.address]);

    const ADMIN_ROLE = await contract.ADMIN_ROLE();
    const TEACHER_ROLE = await contract.TEACHER_ROLE();
    const STUDENT_ROLE = await contract.STUDENT_ROLE();

    await contract.connect(admin).grantRole(ADMIN_ROLE, admin.address);
    await contract.connect(admin).grantRole(TEACHER_ROLE, teacher1.address);
    await contract.connect(admin).grantRole(TEACHER_ROLE, teacher2.address);
    await contract.connect(admin).grantRole(STUDENT_ROLE, student.address);

    return { contract, admin, teacher1, teacher2, student, outsider };
  }

  it("enforces 2-teacher approvals before finalization", async function () {
    const { contract, teacher1, teacher2 } = await deployFixture();

    const latestBlock = await ethers.provider.getBlock("latest");
    const releaseTime = BigInt(latestBlock.timestamp + 3600);

    await expect(contract.connect(teacher1).uploadContent("ipfs://exam-paper-1", releaseTime))
      .to.emit(contract, "ContentUploaded")
      .withArgs(0n, teacher1.address, "ipfs://exam-paper-1", releaseTime);

    await expect(contract.connect(teacher1).approveContent(0)).to.emit(contract, "ContentApproved");

    await expect(contract.connect(teacher1).finalizeContent(0))
      .to.be.revertedWithCustomError(contract, "InsufficientApprovals")
      .withArgs(0n, 1n, 2n);

    await expect(contract.connect(teacher2).approveContent(0))
      .to.emit(contract, "ContentApproved")
      .withArgs(0n, teacher2.address, 2n);

    await expect(contract.connect(teacher1).finalizeContent(0))
      .to.emit(contract, "ContentReleased")
      .withArgs(0n, releaseTime);
  });

  it("allows only NFT-holding student to access content after timelock", async function () {
    const { contract, admin, teacher1, teacher2, student, outsider } = await deployFixture();
    const STUDENT_ROLE = await contract.STUDENT_ROLE();

    const latestBlock = await ethers.provider.getBlock("latest");
    const releaseTime = BigInt(latestBlock.timestamp + 1800);

    await contract.connect(teacher1).uploadContent("ipfs://exam-paper-2", releaseTime);
    await contract.connect(teacher1).approveContent(0);
    await contract.connect(teacher2).approveContent(0);
    await contract.connect(teacher1).finalizeContent(0);

    await expect(contract.connect(admin).mintAccessNFT(student.address, 0))
      .to.emit(contract, "AccessGranted")
      .withArgs(0n, student.address, 0n);

    await expect(contract.connect(student).getContent(0)).to.be.revertedWithCustomError(contract, "ContentLocked");

    await ethers.provider.send("evm_increaseTime", [1810]);
    await ethers.provider.send("evm_mine", []);

    const content = await contract.connect(student).getContent(0);
    expect(content[0]).to.equal("ipfs://exam-paper-2");
    expect(content[1]).to.equal(releaseTime);

    await expect(contract.connect(outsider).getContent(0))
      .to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
      .withArgs(outsider.address, STUDENT_ROLE);
  });

  it("prevents duplicate teacher approvals and duplicate student grants", async function () {
    const { contract, admin, teacher1, teacher2, student } = await deployFixture();

    const latestBlock = await ethers.provider.getBlock("latest");
    const releaseTime = BigInt(latestBlock.timestamp + 3000);

    await contract.connect(teacher1).uploadContent("ipfs://exam-paper-3", releaseTime);
    await contract.connect(teacher1).approveContent(0);

    await expect(contract.connect(teacher1).approveContent(0))
      .to.be.revertedWithCustomError(contract, "AlreadyApproved")
      .withArgs(0n, teacher1.address);

    await contract.connect(teacher2).approveContent(0);
    await contract.connect(teacher1).finalizeContent(0);

    await contract.connect(admin).mintAccessNFT(student.address, 0);

    await expect(contract.connect(admin).mintAccessNFT(student.address, 0))
      .to.be.revertedWithCustomError(contract, "AccessAlreadyGranted")
      .withArgs(0n, student.address);
  });
});