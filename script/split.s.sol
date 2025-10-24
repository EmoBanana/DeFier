// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/split.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();
        new Split(0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9);
        vm.stopBroadcast();
    }
}
