// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract EcoToken {

    string public name = "EcoToken";
    string public symbol = "ECO";
    uint public totalSupply = 0;

    mapping(address => uint) public balanceOf;

    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function mint(address to, uint amount) public {

        require(msg.sender == owner, "Only owner can mint");

        balanceOf[to] += amount;
        totalSupply += amount;
    }
}











