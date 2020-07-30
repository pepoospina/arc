pragma solidity  ^0.6.12;
// SPDX-License-Identifier: GPL-3.0

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/IERC721Receiver.sol";

contract IERC721NonReceiverMock is IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes memory)
    public override returns (bytes4)
    {
        return bytes4(keccak256("Don't Receive ERC721"));
    }
}
