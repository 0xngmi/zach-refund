const { MerkleTree } = require('merkletreejs')
const keccak256 = require('keccak256')
const fs = require('fs');
const { getAddress } = require('ethers/lib/utils');

const REDUCTION_RATIO = 1.096 / 1.274;

function paddedBuffer(addr, amount){
    //const [int, decimals] = amount.split('.')
    //const bigint = BigInt(int + (decimals??'').slice(0, 18).padEnd(18, '0'))
    const bigint = BigInt(Number((Number(amount)*1e6).toFixed(0))) // some precision loss
    const buf = Buffer.from(addr.substr(2).padStart(32*2, "0")+bigint.toString(16).padStart(32*2, "0"), "hex")
    return {
        leaf: keccak256(Buffer.concat([buf])),
        amount: bigint.toString()
    }
}

function buildTree(chain = "ethereum") {
    const balances = {}
    if(chain === "ethereum"){
        fs.readFileSync("./scripts/final-lists/eth.csv", "utf-8").split("\n").slice(1).map(r=>{
            const row = r.split(',')
            if(row[3] !== ""){
                return
            }
            const amount = row[4].length===0?'0':row[4]
            const address = getAddress(row[2])
            balances[address] = Number(amount)
        })
    } else if(chain === "arbitrum"){
        fs.readFileSync("./scripts/final-lists/arbi.csv", "utf-8").split("\n").slice(1).map(r=>{
            const row = r.split(',')
            if(row[4].includes("x")){
                return // excluded
            }
            const amount = row[3].length===0?'0':row[3]
            const address = getAddress(row[0])
            balances[address] = Number(amount)
        })
    }
    const csv = Object.entries(balances).map(([address, amount])=>({address, amount: amount * REDUCTION_RATIO}))
    const tree = new MerkleTree(csv.map(x => paddedBuffer(x.address, x.amount).leaf), keccak256, { sort: true })
    return {tree, csv}
}

function storeTree(chain = "ethereum") {
    const {tree, csv} = buildTree(chain)
    const proofs = {}
    for(const {address, amount: amountNum} of csv){
        const {leaf, amount} = paddedBuffer(address, amountNum)
        const proof = tree.getHexProof(leaf)
        proofs[address] = {proof, amount}
    }
    fs.writeFileSync(`proofs_${chain}.json`, JSON.stringify(proofs))
    return tree.getHexRoot()
}

module.exports={
    buildTree,
    paddedBuffer,
    REDUCTION_RATIO,
    storeTree
}

async function main() {
    const root = storeTree("ethereum")
    console.log("root", root)
    process.exit(0)
}

//main()
