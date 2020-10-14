pragma solidity ^0.6.12;
// SPDX-License-Identifier: GPL-3.0
pragma experimental ABIEncoderV2;

import "./SchemeConstraints.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";


contract DxDaoSchemeConstraints is SchemeConstraints, Initializable {
    using SafeMath for uint256;

    event WhiteListedContracts(address[] _contractsWhitelist);

    uint256 public initialTimestamp;
    uint256 public periodSize;
    uint256 public periodLimitWei;

    mapping(address=>uint256) public periodLimitToken;
    mapping (uint256 => mapping(address => uint256)) public periodSpendingToken;
    mapping(uint256=>uint256) public periodSpendingWei;
    mapping(address=>bool) public contractsWhitelist;
    bytes4 private constant APPROVE_SIGNATURE = 0x095ea7b3;//approve(address,uint256)

    /* @dev initialize
     * @param _avatar the avatar to mint reputation from
     * @param _votingMachine the voting machines address to
     * @param _voteParams voting machine parameters.
     * @param _contractsWhitelist the contracts the scheme is allowed to interact with
     */
    function initialize(
        uint256 _periodSize,
        uint256 _periodLimitWei,
        address[] calldata _periodLimitTokensAddresses,
        uint256[] calldata _periodLimitTokensAmounts,
        address[] calldata _contractsWhitelist
    )
    external initializer {
        require(_periodSize > 0, "preriod size should be greater than 0");
        require(_periodLimitTokensAddresses.length == _periodLimitTokensAmounts.length,
        "invalid length _periodLimitTokensAddresses");
        periodSize = _periodSize;
        periodLimitWei = _periodLimitWei;
        // solhint-disable-next-line not-rely-on-time
        initialTimestamp = block.timestamp;
        for (uint i = 0; i < _contractsWhitelist.length; i++) {
            contractsWhitelist[_contractsWhitelist[i]] = true;
        }
        emit WhiteListedContracts(_contractsWhitelist);
        for (uint i = 0; i < _periodLimitTokensAmounts.length; i++) {
            periodLimitToken[_periodLimitTokensAddresses[i]] = _periodLimitTokensAmounts[i];
        }
    }

    function isAllowedToCall(
        address[] calldata _contractsToCall,
        bytes[] calldata _callsData,
        uint256[] calldata _values,
        Avatar
    )
    external
    override
    returns(bool)
    {

        uint256 observervationIndex = observationIndex();
        uint256 totalPeriodSpendingInWei;
        for (uint i = 0; i < _contractsToCall.length; i++) {
        // constraint eth transfer
            totalPeriodSpendingInWei = totalPeriodSpendingInWei.add(_values[i]);
            bytes memory callData = _callsData[i];
        // constraint approve calls
            if (callData[0] == APPROVE_SIGNATURE[0] &&
                callData[1] == APPROVE_SIGNATURE[1] &&
                callData[2] == APPROVE_SIGNATURE[2] &&
                callData[3] == APPROVE_SIGNATURE[3]) {
                uint256 amount;
                address contractToCall = _contractsToCall[i];
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    amount := mload(add(callData, 68))
                }
                periodSpendingToken[observervationIndex][contractToCall] =
                periodSpendingToken[observervationIndex][contractToCall].add(amount);
                require(
                periodSpendingToken[observervationIndex][contractToCall] <= periodLimitToken[contractToCall],
                "periodSpendingTokensExceeded");
            }

        }
        periodSpendingWei[observervationIndex] =
        periodSpendingWei[observervationIndex].add(totalPeriodSpendingInWei);
        require(periodSpendingWei[observervationIndex] <= periodLimitWei, "periodSpendingWeiExceeded");
        return true;
    }

    function isAllowedToPropose(
        address[] calldata _contractsToCall,
        bytes[] calldata _callsData,
        uint256[] calldata,
        Avatar)
    external
    override
    returns(bool)
    {
        for (uint i = 0; i < _contractsToCall.length; i++) {
        // constraint approve calls
            if (!contractsWhitelist[_contractsToCall[i]]) {
                address spender;
                bytes memory callData = _callsData[i];
                require(
                    callData[0] == APPROVE_SIGNATURE[0] &&
                    callData[1] == APPROVE_SIGNATURE[1] &&
                    callData[2] == APPROVE_SIGNATURE[2] &&
                    callData[3] == APPROVE_SIGNATURE[3],
                "allow only approve call for none whitelistedContracts");
                //in solidity > 6 this can be replaced by:
                //(spender,) = abi.decode(callData[4:], (address, uint));
                // see https://github.com/ethereum/solidity/issues/9439
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    spender := mload(add(callData, 36))
                }
                require(contractsWhitelist[spender], "spender contract not whitelisted");
            }
        }
        return true;
    }

    function observationIndex() public view returns (uint256) {
        // solhint-disable-next-line not-rely-on-time
        return ((block.timestamp - initialTimestamp) / periodSize);
    }

}
