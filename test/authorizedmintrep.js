const helpers = require('./helpers');
const DaoCreator = artifacts.require('./DaoCreator.sol');
const ControllerCreator = artifacts.require('./ControllerCreator.sol');
const DAOTracker = artifacts.require('./DAOTracker.sol');
const constants = require('./constants');
var AuthorizedMintRep = artifacts.require('./AuthorizedMintRep.sol');

const setup = async function(
  accounts,
  _activationStartTime = 0,
  _activationEndTime = 3000,
  _maxRepReward = 100,
  _initialize = true
) {
  var testSetup = new helpers.TestSetup();
  var controllerCreator = await ControllerCreator.new({
    gas: constants.ARC_GAS_LIMIT
  });
  var daoTracker = await DAOTracker.new({ gas: constants.ARC_GAS_LIMIT });
  testSetup.daoCreator = await DaoCreator.new(
    controllerCreator.address,
    daoTracker.address,
    { gas: constants.ARC_GAS_LIMIT }
  );

  testSetup.org = await helpers.setupOrganization(
    testSetup.daoCreator,
    accounts[0],
    1000,
    1000
  );
  testSetup.activationStartTime =
    (await web3.eth.getBlock('latest')).timestamp + _activationStartTime;
  testSetup.activationEndTime =
    (await web3.eth.getBlock('latest')).timestamp + _activationEndTime;
  testSetup.maxRepReward = _maxRepReward;
  testSetup.authorizedMintRep = await AuthorizedMintRep.new();
  if (_initialize === true) {
    await testSetup.authorizedMintRep.initialize(
      testSetup.org.avatar.address,
      testSetup.activationStartTime,
      testSetup.activationEndTime,
      testSetup.maxRepReward,
      accounts[1],
      { gas: constants.ARC_GAS_LIMIT }
    );
  }

  var permissions = '0x00000000';
  await testSetup.daoCreator.setSchemes(
    testSetup.org.avatar.address,
    [testSetup.authorizedMintRep.address],
    [web3.utils.asciiToHex('0')],
    [permissions],
    'metaData'
  );

  return testSetup;
};

contract('AuthorizedMintRep', accounts => {
  it('initialize', async () => {
    let testSetup = await setup(accounts);

    assert.equal(
      await testSetup.authorizedMintRep.repRewardLeft(),
      testSetup.maxRepReward
    );
    assert.equal(
      await testSetup.authorizedMintRep.activationStartTime(),
      testSetup.activationStartTime
    );
    assert.equal(
      await testSetup.authorizedMintRep.activationEndTime(),
      testSetup.activationEndTime
    );
    assert.equal(
      await testSetup.authorizedMintRep.authorizedAddress(),
      accounts[1]
    );
  });

  it('initialize _activationStartTime >= activationEndTime is not allowed', async () => {
    let testSetup = await setup(accounts);
    let authorizedMintRep = await AuthorizedMintRep.new();
    try {
      await authorizedMintRep.initialize(
        testSetup.org.avatar.address,
        testSetup.activationStartTime,
        testSetup.activationStartTime - 1,
        testSetup.maxRepReward,
        accounts[1],
        { gas: constants.ARC_GAS_LIMIT }
      );
      assert(false, '_redeemEnableTime < auctionsEndTime is not allowed');
    } catch (error) {
      helpers.assertVMException(error);
    }
  });

  it('mint reputation', async () => {
    let testSetup = await setup(accounts);
    await testSetup.authorizedMintRep.reputationMint(accounts[2], 1, {
      from: accounts[1]
    });

    assert.equal(await testSetup.org.reputation.balanceOf(accounts[2]), 1);
  });

  it('mint reputation by unauthorized account should fail', async () => {
    let testSetup = await setup(accounts);
    try {
      await testSetup.authorizedMintRep.reputationMint(accounts[2], 1, {
        from: accounts[0]
      });
      assert(false, 'mint reputation by unauthorized account should fail');
    } catch (error) {
      helpers.assertVMException(error);
    }
  });

  it('mint without initialize should fail', async () => {
    let testSetup = await setup(accounts, 0, 3000, 100, false);
    try {
      await testSetup.authorizedMintRep.reputationMint(accounts[2], 1, {
        from: accounts[1]
      });
      assert(false, 'mint without initialize should fail');
    } catch (error) {
      helpers.assertVMException(error);
    }
  });

  it('mint before _activationStartTime should fail', async () => {
    let testSetup = await setup(accounts, 2000, 3000, 100, true);
    try {
      await testSetup.authorizedMintRep.reputationMint(accounts[2], 1, {
        from: accounts[1]
      });
      assert(false, 'mint before _activationStartTime should fail');
    } catch (error) {
      helpers.assertVMException(error);
    }
  });

  it('mint after _activationEndTime should revert', async () => {
    let testSetup = await setup(accounts);
    await helpers.increaseTime(3001);
    try {
      await testSetup.authorizedMintRep.reputationMint(accounts[2], 1, {
        from: accounts[1]
      });
      assert(false, 'mint after _activationEndTime should revert');
    } catch (error) {
      helpers.assertVMException(error);
    }
  });

  it('mint more than _maxRepReward should fail', async () => {
    let testSetup = await setup(accounts);
    try {
      await testSetup.authorizedMintRep.reputationMint(accounts[2], 101, {
        from: accounts[1]
      });
      assert(false, 'mint more than _maxRepReward should fail');
    } catch (error) {
      helpers.assertVMException(error);
    }
  });

  it('mint reputation with 0 _maxRepReward should allow any amount', async () => {
    let testSetup = await setup(accounts, 0, 3000, 0, true);
    await testSetup.authorizedMintRep.reputationMint(accounts[2], 1000, {
      from: accounts[1]
    });

    assert.equal(await testSetup.org.reputation.balanceOf(accounts[2]), 1000);
  });

  it('cannot initialize twice', async () => {
    let testSetup = await setup(accounts);
    try {
      await testSetup.authorizedMintRep.initialize(
        testSetup.org.avatar.address,
        testSetup.activationStartTime,
        testSetup.activationEndTime,
        testSetup.maxRepReward,
        accounts[1],
        { gas: constants.ARC_GAS_LIMIT }
      );
      assert(false, 'cannot initialize twice');
    } catch (error) {
      helpers.assertVMException(error);
    }
  });
});
