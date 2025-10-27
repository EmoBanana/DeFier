# DeFier

DeFier is an AI-powered DeFi assistant that aims to defy complexity. It combines a context-supported conversational frontend with on-chain functionality to make decentralised finance accessible, intuitive, and simple. Users can interact naturally by typing commands such as “Send 1 PYUSD to wenn.eth on Sepolia”, and the assistant securely translates those requests into verified blockchain transactions.  

Beyond simple transfers, DeFier can also answer blockchain-related questions about tokens, markets, transactions, blocks, and ENS names. It supports sending, bridging, and splitting transactions while tracking them in real time without requiring users to manually copy hashes or look them up. The app also supports PYUSD natively through a custom smart contract that allows both direct transfers and split payments. Everything in DeFier is done by simply prompting — as if you were talking to someone about what you want to do.  

DeFier is built to make blockchain interactions feel natural and familiar for both Web2 and Web3 users. Much like PayPal, it focuses on user simplicity and accessibility, but for decentralised systems. By removing friction and technical overhead, DeFier aims to bridge the gap between conversational AI and on-chain execution.

---

## How It Works

DeFier uses an AI-driven chat interface powered by Gemini 2.5 Flash, supported by the Model Context Protocol (MCP) for context-aware interactions. MCP tools such as Blockscout MCP and CoinGecko MCP provide reliable, up-to-date blockchain and token data. Users can ask for prices, verify transactions, resolve ENS names, or query block details — all in one interface.  

The app also integrates Avail Nexus Core and Avail Nexus Widgets to perform inline transaction execution and visualise bridging processes. The widgets enhance the user experience by displaying transaction flow and fund movements across chains in real time. The Blockscout SDK is used to monitor and update transaction statuses dynamically once a transaction is submitted, eliminating the need for manual lookups.

---

## Tech Stack

**Frontend:**  
- Next.js (App Router) for the main user interface  
- RainbowKit and Wagmi for wallet connection  
- Ethers v6 for contract interaction  
- Tailwind CSS for styling  

**Backend:**  
- Foundry for Solidity contract development, deployment, and testing  
- Node.js API routes for chat endpoint and on-chain utilities  

**Smart Contracts:**  
- Written in Solidity using Foundry  
- `Split` contract deployed on Sepolia that supports ERC-20 transfers and split functions  
- Handles PYUSD natively for both simple and batch transactions  

**AI & Data Integration:**  
- Gemini 2.5 Flash as the conversational model  
- Model Context Protocol (MCP) to enable contextual querying with:  
  - CoinGecko MCP for market and token data  
  - Blockscout MCP for transaction, block, and address data (including ENS resolution)  

**Partner Technologies:**  
- Avail Nexus Core for secure cross-chain execution within the chat  
- Avail Nexus Widgets for visualising bridging flows and transaction context  
- Blockscout SDK for live transaction tracking and event updates
- PayPal USD as native platform currency

---

## Development

### Prerequisites
- Node.js ≥ 20  
- Foundry (`forge`, `cast`, `anvil`) installed  
- A Sepolia RPC provider (e.g. Infura or Alchemy)  
- A wallet such as MetaMask  

### Build and Run

```bash
# Install dependencies
npm install

# Start the frontend
npm run dev

# Run Foundry build
forge build

# Run tests
forge test -vvv
```

---

## Key Features

- **Natural Language Interface:** Perform blockchain actions simply by describing what you want to do.  
- **On-Chain Execution:** Send, bridge, or split transactions securely via verified contracts.  
- **MCP-Driven Context:** AI that understands tokens, blocks, transactions, and ENS lookups.  
- **Real-Time Tracking:** Blockscout SDK integration provides live transaction updates.  
- **PYUSD Native Support:** The deployed smart contract uses PYUSD as the native currency for demonstration.  
- **Cross-Chain Ready:** Avail Nexus integration enables bridging and interoperability directly within chat.  

---

## Why It Fits ETHGlobal Partner Tracks

**Avail:**  
DeFier integrates Avail Nexus Core and Nexus Widgets to handle cross-chain actions directly within the chat interface. By embedding Avail’s modular execution layer, it demonstrates seamless interoperability and intuitive fund movement, aligning perfectly with the Avail track’s goal of simplifying cross-chain user experiences.

**Blockscout:**  
DeFier uses both Blockscout MCP and the Blockscout SDK for real-time transaction tracking, ENS resolution, and block data retrieval, making it a strong fit for the Blockscout prize track.

**PayPal USD (PYUSD):**  
The project supports PYUSD through its own deployed smart contract that handles transfer and split operations, using PYUSD as the native currency within DeFier. This demonstrates practical adoption of PayPal USD in conversational blockchain experiences.

---
Made with ❤️

Made with care for ETHGlobal.  
Built by Florian Olyff.  
