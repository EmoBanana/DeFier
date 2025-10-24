// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Split {
    IERC20 public token;

    constructor(address _token) {
        token = IERC20(_token);
    }

    function split(address[] memory to, uint256[] memory amt) external {
        require(to.length == amt.length, "len mismatch");

        uint256 total;
        for (uint256 i = 0; i < amt.length; i++) total += amt[i];

        require(token.allowance(msg.sender, address(this)) >= total, "no allowance");
        require(token.balanceOf(msg.sender) >= total, "no balance");

        for (uint256 i = 0; i < to.length; i++) {
            require(token.transferFrom(msg.sender, to[i], amt[i]), "transfer fail");
        }
    }
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}
