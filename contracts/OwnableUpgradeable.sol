// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
abstract contract OwnableUpgradeable is Initializable {
    address private _owner;
    address private _manager;
    bool private _initialized;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == _owner||msg.sender==_manager, "Ownable: caller is not the owner");
        _;
    }

    function __Ownable_init(address initialOwner) internal initializer {
        require(initialOwner != address(0), "Ownable: new owner is the zero address");
        _owner = initialOwner;
        _manager = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function owner() public view returns (address) {
        return _owner;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }

    function renounceOwnership() public onlyOwner {
        emit OwnershipTransferred(_owner, address(0));
        _owner = address(0);
    }
}
