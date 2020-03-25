import * as helpers from './helpers';
const JoinAndQuit = artifacts.require("./JoinAndQuit.sol");
const FundingRequest = artifacts.require("./FundingRequest.sol");
const ERC20Mock = artifacts.require('./test/ERC20Mock.sol');

export class JoinAndQuitParams {
  constructor() {
  }
}

export class FundingRequestParams {
  constructor() {
  }
}

const setupJoinAndQuit = async function(
                                            accounts,
                                            genesisProtocol,
                                            token,
                                            avatarAddress,
                                            _fundingToken,
                                            _minFeeToJoin,
                                            _memberReputation,
                                            _fundingGoal,
                                            _fundingGoalDeadLine
                                            ) {
  var joinAndQuitParams = new JoinAndQuitParams();

  if (genesisProtocol === true) {
    joinAndQuitParams.votingMachine = await helpers.setupGenesisProtocol(accounts,token,helpers.NULL_ADDRESS);
    joinAndQuitParams.initdata = await new web3.eth.Contract(registration.joinAndQuit.abi)
                          .methods
                          .initialize(avatarAddress,
                            joinAndQuitParams.votingMachine.genesisProtocol.address,
                            joinAndQuitParams.votingMachine.params,
                            _fundingToken,
                            _minFeeToJoin,
                            _memberReputation,
                            _fundingGoal,
                           _fundingGoalDeadLine)
                          .encodeABI();
    } else {
  joinAndQuitParams.votingMachine = await helpers.setupAbsoluteVote(helpers.NULL_ADDRESS,50);
  joinAndQuitParams.initdata = await new web3.eth.Contract(registration.joinAndQuit.abi)
                        .methods
                        .initialize(avatarAddress,
                          joinAndQuitParams.votingMachine.absoluteVote.address,
                          joinAndQuitParams.votingMachine.params,
                          _fundingToken,
                          _minFeeToJoin,
                          _memberReputation,
                          _fundingGoal,
                         _fundingGoalDeadLine)
                        .encodeABI();
  }
  return joinAndQuitParams;
};


const setupFundingRequest = async function(
                                            accounts,
                                            genesisProtocol,
                                            token,
                                            avatarAddress,
                                            externalToken) {
  var fundingRequestParams = new FundingRequestParams();

  if (genesisProtocol === true) {
    fundingRequestParams.votingMachine = await helpers.setupGenesisProtocol(accounts,token,helpers.NULL_ADDRESS);
    fundingRequestParams.initdata = await new web3.eth.Contract(registration.fundingRequest.abi)
                          .methods
                          .initialize(avatarAddress,
                            fundingRequestParams.votingMachine.genesisProtocol.address,
                            fundingRequestParams.votingMachine.params,
                            externalToken
                          )
                          .encodeABI();
    } else {
      fundingRequestParams.votingMachine = await helpers.setupAbsoluteVote(helpers.NULL_ADDRESS,50);
      fundingRequestParams.initdata = await new web3.eth.Contract(registration.fundingRequest.abi)
                        .methods
                        .initialize(avatarAddress,
                          fundingRequestParams.votingMachine.absoluteVote.address,
                          fundingRequestParams.votingMachine.params,
                          externalToken
                        )
                        .encodeABI();
  }
  return fundingRequestParams;
};

var registration;
const setup = async function (accounts,
                              setupJAQProposal=true,
                              genesisProtocol = false,
                              tokenAddress=0,
                              minFeeToJoin = 100,
                              memberReputation = 100,
                              fundingGoal = 1000,
                              fundingGoalDeadLine = 3000) {
  var testSetup = new helpers.TestSetup();
  testSetup.standardTokenMock = await ERC20Mock.new(accounts[0],100000);
  registration = await helpers.registerImplementation();

  if (genesisProtocol) {
     testSetup.reputationArray = [1000,100,0];
  } else {
     testSetup.reputationArray = [2000,4000,7000];
  }
  testSetup.proxyAdmin = accounts[5];
  testSetup.org = await helpers.setupOrganizationWithArraysDAOFactory(testSetup.proxyAdmin,
                                                                      accounts,
                                                                      registration,
                                                                      [accounts[0],
                                                                      accounts[1],
                                                                      accounts[2]],
                                                                      [1000,0,0],
                                                                      testSetup.reputationArray);
  testSetup.fundingGoalDeadLine = (await web3.eth.getBlock("latest")).timestamp + fundingGoalDeadLine;
  testSetup.minFeeToJoin = minFeeToJoin;
  testSetup.memberReputation = memberReputation;
  testSetup.fundingGoal = fundingGoal;

  testSetup.joinAndQuitParams= await setupJoinAndQuit(
                     accounts,
                     genesisProtocol,
                     tokenAddress,
                     testSetup.org.avatar.address,
                     testSetup.standardTokenMock.address,
                     minFeeToJoin,
                     memberReputation,
                     fundingGoal,
                     testSetup.fundingGoalDeadLine);

  testSetup.fundingRequestParams = await setupFundingRequest(
                     accounts,
                     genesisProtocol,
                     tokenAddress,
                     testSetup.org.avatar.address,
                     testSetup.standardTokenMock.address);

  var permissions = "0x00000000";
  var tx = await registration.daoFactory.setSchemes(
                          testSetup.org.avatar.address,
                          [web3.utils.fromAscii("JoinAndQuit"), web3.utils.fromAscii("FundingRequest")],
                          helpers.concatBytes(testSetup.joinAndQuitParams.initdata, testSetup.fundingRequestParams.initdata),
                          [helpers.getBytesLength(testSetup.joinAndQuitParams.initdata), helpers.getBytesLength(testSetup.fundingRequestParams.initdata)],
                          [permissions, permissions],
                          "metaData",{from:testSetup.proxyAdmin});

  testSetup.joinAndQuit = await JoinAndQuit.at(tx.logs[1].args._scheme);
  testSetup.fundingRequest = await FundingRequest.at(tx.logs[3].args._scheme);

  if(setupJAQProposal) {
    await testSetup.standardTokenMock.approve(testSetup.joinAndQuit.address,testSetup.fundingGoal);

      tx = await testSetup.joinAndQuit.proposeToJoin(
                                                           "description-hash",
                                                           testSetup.fundingGoal,
                                                           helpers.NULL_ADDRESS);
      
      var proposalId = await helpers.getValueFromLogs(tx, '_proposalId',1);
      await testSetup.joinAndQuitParams.votingMachine.absoluteVote.vote(proposalId,1,0,helpers.NULL_ADDRESS,{from:accounts[2]});
  }
  return testSetup;
};
contract('FundingRequest', accounts => {

    it("initialize", async function() {
       var testSetup = await setup(accounts, false);
       assert.equal(await testSetup.fundingRequest.votingMachine(),testSetup.fundingRequestParams.votingMachine.absoluteVote.address);
       assert.equal(await testSetup.fundingRequest.fundingToken(),testSetup.standardTokenMock.address);
    });

    it("can't propose before funded", async() => {
      var testSetup = await setup(accounts, false);
      try {
         await testSetup.fundingRequest.propose(
                                                    accounts[1],
                                                    testSetup.minFeeToJoin-1,
                                                    "description-hash");
         assert(false, "can't propose before funded");
      } catch (ex) {
         helpers.assertVMException(ex);
      }
  });

    it("propose log", async function() {
      var testSetup = await setup(accounts);

      let tx = await testSetup.fundingRequest.propose(
        accounts[1],
        testSetup.minFeeToJoin - 1,
        "description-hash");

      assert.equal(tx.logs.length, 1);
      assert.equal(tx.logs[0].event, "NewFundingProposal");
      assert.equal(tx.logs[0].args._avatar, testSetup.org.avatar.address);
      assert.equal(tx.logs[0].args._beneficiary, accounts[1]);
      assert.equal(tx.logs[0].args._amount, testSetup.minFeeToJoin-1);
      assert.equal(tx.logs[0].args._descriptionHash, "description-hash");
     });

     it("execute proposal yes", async function() {
      var testSetup = await setup(accounts);

      let tx = await testSetup.fundingRequest.propose(
        accounts[1],
        testSetup.minFeeToJoin - 1,
        "description-hash");

      let proposalId = await helpers.getValueFromLogs(tx, '_proposalId',1);
      await testSetup.fundingRequestParams.votingMachine.absoluteVote.vote(proposalId,1,0,helpers.NULL_ADDRESS,{from:accounts[2]});
      var proposal = await testSetup.fundingRequest.proposals(proposalId);
      assert.equal(proposal.executionTime, (await web3.eth.getBlock("latest")).timestamp);
     });


     it("execute proposal no", async function() {
      var testSetup = await setup(accounts);

      let tx = await testSetup.fundingRequest.propose(
        accounts[1],
        testSetup.minFeeToJoin - 1,
        "description-hash");

      let proposalId = await helpers.getValueFromLogs(tx, '_proposalId',1);
      await testSetup.fundingRequestParams.votingMachine.absoluteVote.vote(proposalId,2,0,helpers.NULL_ADDRESS,{from:accounts[2]});
      var proposal = await testSetup.fundingRequest.proposals(proposalId);
      assert.equal(proposal.executionTime, 0);
     });

     it("redeem proposal", async function() {
      var testSetup = await setup(accounts);

      let tx = await testSetup.fundingRequest.propose(
        accounts[1],
        testSetup.minFeeToJoin - 1,
        "description-hash");

      let proposalId = await helpers.getValueFromLogs(tx, '_proposalId',1);
      await testSetup.fundingRequestParams.votingMachine.absoluteVote.vote(proposalId,1,0,helpers.NULL_ADDRESS,{from:accounts[2]});
      var proposal = await testSetup.fundingRequest.proposals(proposalId);
      assert.equal(proposal.executionTime, (await web3.eth.getBlock("latest")).timestamp);
      tx = await testSetup.fundingRequest.redeem(proposalId);
      assert.equal(tx.logs[0].event, "Redeem");
      assert.equal(tx.logs[0].args._avatar, testSetup.org.avatar.address);
      assert.equal(tx.logs[0].args._proposalId, proposalId);
      assert.equal(tx.logs[0].args._beneficiary, accounts[1]);
      assert.equal(tx.logs[0].args._amount, testSetup.minFeeToJoin - 1);
      assert.equal((await testSetup.standardTokenMock.balanceOf(accounts[1])), testSetup.minFeeToJoin - 1);
      proposal = await testSetup.fundingRequest.proposals(proposalId);
      assert.equal(proposal.executionTime, 0);
      assert.equal(proposal.amount, 0);
     });


     it("can't redeem before proposal passed", async function() {
      var testSetup = await setup(accounts);

      let tx = await testSetup.fundingRequest.propose(
        accounts[1],
        testSetup.minFeeToJoin - 1,
        "description-hash");

      let proposalId = await helpers.getValueFromLogs(tx, '_proposalId',1);
      try {
        tx = await testSetup.fundingRequest.redeem(proposalId);
        assert(false, "can't redeem before passed");
      } catch (ex) {
          helpers.assertVMException(ex);
      }
      assert.equal((await testSetup.standardTokenMock.balanceOf(accounts[1])), 0);
     });

     it("don't redeem failed proposal", async function() {
      var testSetup = await setup(accounts);

      let tx = await testSetup.fundingRequest.propose(
        accounts[1],
        testSetup.minFeeToJoin - 1,
        "description-hash");

      let proposalId = await helpers.getValueFromLogs(tx, '_proposalId',1);
      await testSetup.fundingRequestParams.votingMachine.absoluteVote.vote(proposalId,2,0,helpers.NULL_ADDRESS,{from:accounts[2]});
      var proposal = await testSetup.fundingRequest.proposals(proposalId);
      assert.equal(proposal.executionTime, 0);
      try {
        tx = await testSetup.fundingRequest.redeem(proposalId);
        assert(false, "can't redeem failed proposal");
      } catch (ex) {
          helpers.assertVMException(ex);
      }
      assert.equal((await testSetup.standardTokenMock.balanceOf(accounts[1])), 0);
     });

     it("can't redeem proposal twice", async function() {
      var testSetup = await setup(accounts);

      let tx = await testSetup.fundingRequest.propose(
        accounts[1],
        testSetup.minFeeToJoin - 1,
        "description-hash");

      let proposalId = await helpers.getValueFromLogs(tx, '_proposalId',1);
      await testSetup.fundingRequestParams.votingMachine.absoluteVote.vote(proposalId,1,0,helpers.NULL_ADDRESS,{from:accounts[2]});
      var proposal = await testSetup.fundingRequest.proposals(proposalId);
      assert.equal(proposal.executionTime, (await web3.eth.getBlock("latest")).timestamp);
      tx = await testSetup.fundingRequest.redeem(proposalId);
      assert.equal(tx.logs[0].event, "Redeem");
      assert.equal(tx.logs[0].args._avatar, testSetup.org.avatar.address);
      assert.equal(tx.logs[0].args._proposalId, proposalId);
      assert.equal(tx.logs[0].args._beneficiary, accounts[1]);
      assert.equal(tx.logs[0].args._amount, testSetup.minFeeToJoin - 1);
      assert.equal((await testSetup.standardTokenMock.balanceOf(accounts[1])), testSetup.minFeeToJoin - 1);
      try {
        tx = await testSetup.fundingRequest.redeem(proposalId);
        assert(false, "can't redeem proposal twice");
      } catch (ex) {
          helpers.assertVMException(ex);
      }
      assert.equal((await testSetup.standardTokenMock.balanceOf(accounts[1])), testSetup.minFeeToJoin - 1);
     });
});