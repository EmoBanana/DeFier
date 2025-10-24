// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/split.sol";

contract SplitTest is Test {
    Split s;
    address pyusd = address(0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9);

    address alice = address(0x123);
    address bob = address(0x456);
    address carol = address(0x789);

    function setUp() public {
        s = new Split(pyusd);
    }

    function testSplitBill_MocksPYUSD() public {
        // recipients and amounts (using 18 decimals here; adjust to PYUSD decimals if needed)
        address[] memory to = new address[](2);
        uint256[] memory amt = new uint256[](2);
        to[0] = bob;
        to[1] = carol;
        amt[0] = 40 ether;
        amt[1] = 60 ether;

        uint256 total = amt[0] + amt[1];

        // Mock allowance and balanceOf for msg.sender -> address(this)
        vm.mockCall(
            pyusd,
            abi.encodeWithSelector(IERC20.allowance.selector, address(this), address(s)),
            abi.encode(total)
        );
        vm.mockCall(
            pyusd,
            abi.encodeWithSelector(IERC20.balanceOf.selector, address(this)),
            abi.encode(total)
        );

        // Mock transferFrom for each recipient to return true
        vm.mockCall(
            pyusd,
            abi.encodeWithSelector(IERC20.transferFrom.selector, address(this), to[0], amt[0]),
            abi.encode(true)
        );
        vm.mockCall(
            pyusd,
            abi.encodeWithSelector(IERC20.transferFrom.selector, address(this), to[1], amt[1]),
            abi.encode(true)
        );

        s.split(to, amt);
    }

    function testSplitBill_RevertsOnLengthMismatch() public {
        address[] memory to = new address[](1);
        uint256[] memory amt = new uint256[](2);
        to[0] = bob;
        amt[0] = 1;
        amt[1] = 2;
        vm.expectRevert(bytes("len mismatch"));
        s.split(to, amt);
    }
}
