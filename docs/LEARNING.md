# A Practical Guide to Polymarket and BTC 5-Minute Markets

## What is Polymarket

Polymarket is a prediction market platform built on the Polygon blockchain. The core idea is straightforward: you buy shares in the outcome of a real-world event, and those shares either pay out $1.00 or $0.00 depending on whether the event happens. If you believe something is likely to occur, you buy shares cheaply and profit when the event resolves in your favor.

The price of a share on Polymarket reflects the market-implied probability of that outcome. A share trading at $0.70 means the collective market believes there is roughly a 70% chance that outcome will happen. This is not just a number pulled from thin air -- it is the result of real people putting real money behind their beliefs. When the price moves, it means the balance of opinion (backed by capital) has shifted.

## Binary Markets

Most Polymarket markets are binary, meaning there are exactly two possible outcomes. Think of it as a coin with two sides: Yes/No, or in the case of price markets, UP/DOWN. The key property of a binary market is that the prices of the two sides are complementary -- they always sum to $1.00. If UP shares are trading at $0.55, then DOWN shares must be trading at $0.45.

```
              Binary Market
    ┌──────────────┬──────────────┐
    │     UP       │    DOWN      │
    │   $0.55      │   $0.45      │
    │              │              │
    │  Wins if BTC │  Wins if BTC │
    │  finishes    │  finishes    │
    │  ABOVE ref   │  BELOW ref   │
    └──────────────┴──────────────┘
          UP + DOWN = $1.00
```

When the market resolves, only one side wins. The winning side pays out $1.00 per share, and the losing side pays out $0.00. There is no partial payout, no middle ground. You are either right or you are wrong, and the market settles accordingly.

## The Order Book

Unlike many DeFi platforms that use Automated Market Makers (AMMs) to facilitate trading, Polymarket uses a Central Limit Order Book, or CLOB. This is the same mechanism that powers traditional stock exchanges like the NYSE or NASDAQ. Instead of trading against a liquidity pool governed by a mathematical formula, you are trading against other people who have placed specific orders at specific prices.

The order book is a real-time ledger of all outstanding buy and sell orders for a given market. It shows you exactly how many shares people want to buy at each price level, and how many shares people want to sell at each price level. This transparency is what makes the CLOB powerful -- you can see the supply and demand landscape before you commit to a trade.

## Bids and Asks

The order book is organized into two sides: bids and asks. A bid is an order from a buyer, representing the highest price they are willing to pay for a share. An ask is an order from a seller, representing the lowest price they are willing to accept. At any given moment, the highest bid and the lowest ask define the current state of the market.

```
            Order Book (UP side)

     BIDS (buyers)          ASKS (sellers)
  ┌──────────────────┐  ┌──────────────────┐
  │ $0.52  ×  150    │  │ $0.55  ×  200    │  <-- best ask
  │ $0.51  ×   80    │  │ $0.56  ×  120    │
  │ $0.50  ×  300    │  │ $0.57  ×   90    │
  │ $0.49  ×  220    │  │ $0.58  ×  400    │
  │ $0.48  ×  100    │  │ $0.59  ×  150    │
  └──────────────────┘  └──────────────────┘
          ^
       best bid

        spread = $0.55 - $0.52 = $0.03
```

For example, suppose the best bid for UP shares is $0.52 and the best ask is $0.55. This means the most aggressive buyer is willing to pay $0.52 per share, and the most aggressive seller is willing to part with shares at $0.55. The gap between these two prices is called the spread, and it plays a critical role in how trades get executed.

## Limit Orders and How They Get Filled

Polymarket only supports limit orders. Unlike a market order, which says "buy at whatever price is available right now," a limit order says "buy at this price or better." When you place a buy limit order, you specify the maximum price you are willing to pay. When you place a sell limit order, you specify the minimum price you are willing to accept.

Here is where it gets interesting. If you place a buy limit order at a price that is at or above the current best ask, your order gets filled immediately. This is sometimes called "lifting the ask" or "crossing the spread." For instance, if the best ask for UP shares is $0.55 and you place a buy limit order at $0.56, your order will match against the $0.55 ask and you will buy at $0.55 (not $0.56 -- you get the better price). If there are not enough shares at $0.55 to fill your entire order, the remainder will fill at the next available ask price, and so on up to your limit of $0.56.

```
  You place: BUY 300 shares @ $0.56 (limit)

  Order book asks:
    $0.55 × 200  ──>  filled 200 @ $0.55
    $0.56 × 120  ──>  filled 100 @ $0.56
                       ─────────────────
                       total: 300 shares
                       avg price: $0.5533
```

If instead you place a buy limit order at $0.52 -- below the best ask -- your order will not fill immediately. It will sit on the order book as a new bid, waiting for a seller to come along and match it.

## Makers, Takers, and Fees

Every trade on Polymarket has two sides: a maker and a taker. Understanding which role you play determines whether you pay fees.

A **maker** is someone whose order rests on the book and adds liquidity. When you place a limit order below the best ask (for buys) or above the best bid (for sells), your order sits on the book waiting to be matched. You are providing liquidity to the market. Maker orders (GTC and GTD, described below) are never charged fees on Polymarket.

A **taker** is someone whose order matches immediately against resting orders and removes liquidity. When you place an order that crosses the spread -- a buy at or above the best ask, or a sell at or below the best bid -- you are taking liquidity from the book. Taker orders (FOK and FAK) demand immediate execution and pay fees.

The taker fee is calculated using the formula:

```
fee = C × feeRate × p × (1 - p)
```

Where `C` is the number of shares traded, `p` is the share price, and `feeRate` is a category-specific rate. The `p × (1 - p)` term means fees are highest at $0.50 (maximum uncertainty) and approach zero near $0.00 or $1.00 (near certainty).

```
  Fee rates by market category:

  Category                              Fee Rate
  ─────────────────────────────────────────────
  Crypto                                0.072
  Finance / Politics / Tech / Mentions  0.04
  Economics / Culture / Weather / Other 0.05
  Sports                                0.03
  Geopolitics                           0 (fee-free)
```

How fees are collected depends on the order side. On buy orders, the fee is deducted in shares -- you pay the full USDC amount but receive fewer shares than the gross fill. On sell orders, the fee is deducted in USDC from the proceeds.

```
  Example: FOK buy 6 shares of UP @ $0.64 (crypto market)

  fee      = 6 × 0.072 × 0.64 × 0.36 = $0.0995
  fee in shares = $0.0995 / $0.64     = 0.1555 shares
  net shares    = 6.00 - 0.1555       = 5.8445 shares

  You paid $3.84 but received 5.8445 shares, not 6.
```

This distinction matters for automated trading. If you buy 6 shares with a FOK order and immediately try to sell 6 shares, the sell will fail because you only hold 5.8445 shares after fees.

For the full fee schedule and current rates, see the [Polymarket fee documentation](https://docs.polymarket.com/trading/fees#fee-structure).

### Order Types

Polymarket supports four order types:

| Type | Behavior | Rests on book | Role | Minimum size |
|------|----------|---------------|------|--------------|
| GTC | Limit order; sits until filled or cancelled | Yes | Maker | 5 shares |
| GTD | GTC with an auto-cancel deadline | Yes | Maker | 5 shares |
| FOK | Fill entirely and immediately, or kill | No | Taker | $1 notional |
| FAK | Fill what's available immediately, kill the rest | No | Taker | $1 notional |

GTC/GTD rest on the public book, so Polymarket enforces a **5-share minimum** to keep the book free of dust. FOK and FAK never rest, so that minimum doesn't apply -- only the much smaller per-market `min_order_size`.

This matters when a partial fill leaves you holding a position smaller than 5 shares:

```
  GTC buy 6 @ $0.59  --> only 1.5 shares fill before the ask moves
  GTC sell 1.5      --> REJECTED: Size (1.5) lower than the minimum: 5
  FAK sell 1.5      --> fills against the bid, exits the residual
```

FAK is the safer default for residual cleanup -- FOK rejects the whole order over a microscopic liquidity gap. Both are takers, so the `C × feeRate × p × (1 - p)` fee still applies.

### Partial Fills and On-Chain Arithmetic

Even with no fees, you may receive slightly fewer shares than requested. When a GTC order is matched against multiple counterparties on-chain (e.g. two sellers each filling part of your order), each fill independently computes the share amount using integer division:

```
shares_received = (usdc_filled × takerAmount) / makerAmount
```

The [CTF Exchange `calculateTakingAmount`](https://github.com/Polymarket/ctf-exchange/blob/main/src/exchange/libraries/CalculatorHelper.sol#L17) uses integer division which truncates — it does not round. Each split fill loses a fraction, and the losses accumulate:

```
  GTC buy 6 shares @ $0.51 — filled in two tranches:

  Tranche 1: 5.31 shares   → integer division truncates down slightly
  Tranche 2: 0.684806 shares → truncates again
                               ─────────────────
  Actual credited: 5.994806 shares (not 6)
```

This is not a fee. Your full USDC was spent, and the order shows as fully matched. The shortfall is purely a rounding artefact of splitting settlement across multiple on-chain transactions. It is typically sub-cent in value but matters if you immediately try to sell the exact amount you requested.

## Shares and Pricing

Share prices on Polymarket range from $0.00 to $1.00, and this range directly maps to probability. A share priced at $0.45 implies a 45% chance of that outcome occurring, according to the market.

The math of profit and loss is simple. If you buy 10 shares of UP at $0.45 each, you spend $4.50. If UP wins, each share pays $1.00, so you receive $10.00 -- a profit of $5.50. If UP loses, each share pays $0.00, and you lose your entire $4.50 investment. The lower the price you buy at, the higher your potential return, but also the lower the market-implied probability that you are right. Buying at $0.10 means a 10x return if you win, but the market is telling you there is only a 10% chance of that happening.

```
  Buy 10 shares of UP @ $0.45

  If UP wins:   10 × $1.00 = $10.00   profit = +$5.50
  If UP loses:  10 × $0.00 =  $0.00   loss   = -$4.50
```

## Liquidity

Liquidity refers to how easily you can buy or sell shares without significantly moving the price. In the context of the order book, a liquid market has many orders stacked at prices close to the current best bid and ask. You can buy or sell large quantities without the price moving much against you.

A thin order book is dangerous. If there are only 50 shares available at the best ask of $0.55, and you want to buy 500 shares, you will quickly exhaust the $0.55 level and start filling at $0.56, $0.57, $0.58, and beyond. This is called slippage -- the difference between the price you expected to pay and the price you actually paid. On a thin book, even a modest order can cause significant slippage.

```
  Thin book — buying 500 shares causes slippage:

  $0.55 × 50   ──>  filled  50 @ $0.55
  $0.56 × 30   ──>  filled  30 @ $0.56
  $0.57 × 20   ──>  filled  20 @ $0.57
  $0.60 × 400  ──>  filled 400 @ $0.60   <-- large jump, thin levels
                     ─────────────────
                     avg: $0.593 (expected $0.55)
                     slippage: $0.043 per share
```

When evaluating a market, always look at the depth of the book. How many shares are available at each price level? If the first five levels of asks only have 200 shares combined, you know this is a thin market and you need to size your orders accordingly.

## The Spread

The spread is the difference between the best bid and the best ask. In a healthy, liquid market, this spread is tight -- perhaps just $0.01 or $0.02. In an illiquid or volatile market, the spread can widen to $0.05, $0.10, or even more.

Why does the spread matter? Because it represents the cost of immediacy. If you want to buy shares right now, you have to pay the ask price. If you want to sell shares right now, you have to accept the bid price. The wider the spread, the more you lose just by entering and exiting a position. If the spread is $0.05 and you buy at the ask and immediately sell at the bid, you have lost $0.05 per share without the market moving at all. Tight spreads mean you can get in and out cheaply. Wide spreads mean you need the market to move significantly in your favor just to break even.

## BTC 5-Minute Markets

Now that you understand how Polymarket works in general, let's talk about the specific market type that this engine trades: BTC 5-Minute Markets.

Every five minutes, a new market opens on Polymarket asking a simple question: will the price of Bitcoin be above or below a reference price at the end of the five-minute window? This reference price is called the "price to beat," and it is set to the BTC price at the moment the market opens. You can buy UP shares if you think BTC will be above the price to beat, or DOWN shares if you think it will be below.

```
  Timeline of a single 5-minute market:

  t=0s                                              t=300s
  │                                                    │
  │  Market opens                     Market closes    │
  │  Price to beat = $68,450          BTC = $68,480    │
  │                                                    │
  │  ├── Order placement ──┤├── Trading ──┤├─ Close ─┤ │
  │                                                    │
  ▼                                                    ▼
  BTC: $68,450                                BTC: $68,480
                                              Gap: +$30 (UP wins)
```

These markets are fast-paced by design. You have a five-minute window to analyze, place orders, and manage your position before the market resolves. There is no overnight holding, no waiting for earnings reports. The feedback loop is immediate: you place a trade, and within minutes you know if you were right.

## Price to Beat and Gap

When a BTC 5-minute market opens, the price to beat is locked in. Suppose BTC is at $68,450 when the market opens -- that becomes the reference price. From that point on, the only question is whether BTC will be above or below $68,450 when the five-minute window closes.

The "gap" is the difference between the current BTC price and the price to beat at any given moment during the window. If BTC has moved up to $68,480, the gap is +$30, which favors UP. If BTC has dropped to $68,420, the gap is -$30, which favors DOWN.

The size of the gap directly influences the share prices in the market. A small gap means the outcome is uncertain, so UP and DOWN shares trade close to $0.50 each. A large positive gap means the market is increasingly confident that BTC will finish above the price to beat, so UP shares climb toward $0.90 or higher while DOWN shares drop toward $0.10 or lower. The larger the gap, the more the ask price on the winning side approaches $1.00, reflecting near-certainty.

```
  Gap vs. share prices (approximate):

  Gap        UP Ask    DOWN Ask    Confidence
  ──────────────────────────────────────────
  +$120      $0.92     $0.08       Very high (UP)
  +$40       $0.65     $0.35       Moderate (UP)
   $0        $0.50     $0.50       Uncertain
  -$40       $0.35     $0.65       Moderate (DOWN)
  -$120      $0.08     $0.92       Very high (DOWN)
```

## Settlement and Resolution

At the end of the five-minute window, the market resolves based on the final BTC price. If BTC is above the price to beat, UP shares pay out $1.00 each and DOWN shares pay out $0.00. If BTC is below the price to beat, the reverse happens: DOWN shares pay $1.00 and UP shares pay $0.00.

Any shares you hold at the moment of resolution are automatically settled. There is no action required on your part -- the payout happens whether you are watching or not. This is why position management before resolution is critical. If you are holding the wrong side when the clock runs out, there is no exit.

To put it concretely: if you bought 100 shares of UP at $0.45 and BTC finishes above the price to beat, you receive $100.00 for a net profit of $55.00. If BTC finishes below, you receive nothing and your $45.00 is gone.

Resolution does not automatically pay you out. Winners must explicitly redeem their shares — either through the Polymarket UI or programmatically — to convert them back to USDC. Until redeemed, winning shares remain locked in the CTF contract and contribute to the market's open interest.

---

## How It Works Under the Hood

Everything described above -- placing orders, holding shares, resolving markets -- is backed by a stack of on-chain protocols running on Polygon. Understanding these layers is not required to use the engine, but it helps to know what is actually happening when you press "buy."

### The Full Stack

```
  ┌─────────────────────────────────────────────────┐
  │              Application Layer                   │
  │         (Web UI, Mobile, Trading Bots)           │
  ├─────────────────────────────────────────────────┤
  │              Service Layer                       │
  │       (CLOB API, Data API, Gamma API)            │
  │     Off-chain order matching, EIP-712 signing    │
  ├─────────────────────────────────────────────────┤
  │              Protocol Layer                      │
  │   ┌──────────────┬──────────┬────────────────┐   │
  │   │ CTF Exchange │ CTF Core │  USDC Token    │   │
  │   │  (Swaps)     │ (Mint/   │  (Collateral)  │   │
  │   │              │  Redeem) │                │   │
  │   └──────────────┴──────────┴────────────────┘   │
  ├─────────────────────────────────────────────────┤
  │              Settlement Layer                    │
  │                 Polygon                          │
  │      (L2 scaling, negligible gas fees)           │
  ├─────────────────────────────────────────────────┤
  │              Resolution Layer                    │
  │    Chainlink (price feeds) / UMA (event-based)   │
  │      (Market outcome verification)               │
  └─────────────────────────────────────────────────┘
```

### Polygon (Settlement Layer)

Polygon operates as a layer-2 scaling solution by processing transactions on separate Ethereum-compatible blockchains and anchoring results back to Ethereum. This reduces network congestion, lowers transaction costs to a fraction of a cent, and significantly increases throughput. This is why gas fees on Polymarket trades are negligible -- you are not paying Ethereum mainnet gas prices.

USDC on Polygon is bridged from Ethereum. When you deposit funds into Polymarket, your USDC is locked on the Polygon side and used as collateral for all trading activity. The bridge ensures your funds are backed 1:1 by real USDC on Ethereum.

### Gnosis Conditional Token Framework (CTF)

This is the core primitive everything is built on. The CTF uses the ERC-1155 multi-token standard to manage all conditional tokens within a single smart contract. The contract maintains a ledger mapping each `positionId` to user addresses and their balances. When you buy shares, the contract updates its internal records to reflect your new balance for that specific position. The token itself does not "move" -- the contract's state changes.

The fundamental principle is collateral locking. For any binary market, you lock $1.00 USDC into the CTF contract, and it mints two new tokens -- one YES and one NO (or UP and DOWN). These represent the complete set of possible outcomes. A complete set can always be redeemed for the original $1.00 collateral, and this is what keeps the market rational.

```
  Collateral locking and redemption:

  Lock:    $1.00 USDC  ──>  1 UP token + 1 DOWN token
  Redeem:  1 UP token + 1 DOWN token  ──>  $1.00 USDC

  This guarantees: UP price + DOWN price = $1.00
```

If UP is trading at $0.70 and DOWN at $0.40, their combined price is $1.10 -- above $1.00. An arbitrageur can mint a complete set for $1.00 and sell both sides for $1.10, locking in $0.10 profit. If the combined price drops below $1.00, an arbitrageur can buy both sides cheaply and redeem them for $1.00. This constant arbitrage pressure forces the combined price toward exactly $1.00.

### CTF Exchange (Atomic Swaps)

The Polymarket CTF Exchange contract facilitates atomic swaps between CTF ERC-1155 assets (your conditional tokens) and ERC-20 collateral (USDC). It operates in a hybrid-decentralized model: order matching happens off-chain for speed, but settlement happens on-chain for security.

Token IDs are derived deterministically from a `conditionId`, which is hashed from a `questionId` (the UMA ancillary data hash), an oracle address, and an outcome slot count (always 2 for binary markets). The two outcomes use index set values of 1 (first outcome) and 2 (second outcome).

### Hybrid CLOB (Order Matching)

The CLOB is the bridge between the off-chain world (fast order matching) and the on-chain world (trustless settlement). When you place an order through the API, it goes to the off-chain operator. The operator matches compatible buy and sell orders, both parties sign via EIP-712, and the matched pair is submitted to the CTF Exchange contract for atomic on-chain settlement.

```
  Order lifecycle:

  You place order ──> Off-chain CLOB matches it
                          │
                          ▼
                    EIP-712 signing
                          │
                          ▼
                   On-chain settlement
                   (CTF Exchange contract)
                          │
                          ▼
              MATCHED ──> MINED ──> CONFIRMED
```

This hybrid approach gives you the speed of a centralized exchange (sub-second matching) with the settlement guarantees of a blockchain (non-custodial, verifiable).

### Oracle Resolution

When a market's time window ends, someone needs to determine the outcome. For BTC 5-minute markets, Polymarket uses Chainlink price feeds as the oracle source. Chainlink aggregates BTC price data from multiple exchanges and delivers it on-chain, providing a tamper-resistant reference price that the contract uses to resolve the market automatically. This is well-suited for price-based markets where the outcome is a verifiable number rather than a subjective judgment.

For other market types (e.g. event-based predictions), Polymarket historically used UMA's Optimistic Oracle, which operates under the assumption that most submitted data is correct and only escalates to a dispute resolution vote if challenged. The choice of oracle depends on the market type -- automated price feeds for objective numerical outcomes, optimistic oracles for markets that require human judgment.

---

## Resources

- Polymarket: https://polymarket.com
- Polymarket CLOB API docs: https://docs.polymarket.com
- Polymarket Learn: https://learn.polymarket.com
- Gnosis CTF official docs: https://conditional-tokens.readthedocs.io/en/latest/developer-guide.html
- Gnosis CTF contracts (Solidity source): https://github.com/gnosis/conditional-tokens-contracts
- Polymarket CTF Exchange contracts: https://github.com/Polymarket/ctf-exchange
- Investopedia Order Book: https://www.investopedia.com/terms/o/order-book.asp
- Investopedia Bid-Ask Spread: https://www.investopedia.com/terms/b/bid-askspread.asp

### Academic and Technical Papers

| Resource | What it covers |
|---|---|
| [TU Munchen Master's Thesis on Polymarket](https://www.cs.cit.tum.de/fileadmin/w00cfj/sebis/_my_direct_uploads/20250903_Parshant_MA_Thesis.pdf) | Full academic treatment: Polygon, CTF, CLOB, AMM, UMA oracle, market design |
| [Gnosis CTF PDF Specification](https://conditional-tokens.readthedocs.io/_/downloads/en/latest/pdf/) | Formal spec for the conditional token framework |
| [Polymarket On-Chain Data Analysis](https://yzc.me/x01Crypto/decoding-polymarket) | How to read raw Polygon events: OrderFilled, PositionSplit, PositionsMerge |
| [Polymarket Architecture Repo](https://github.com/ahollic/polymarket-architecture) | Community-written deep dive into smart contract + API architecture |
| [Polymarket API Architecture (Medium)](https://medium.com/@gwrx2005/the-polymarket-api-architecture-endpoints-and-use-cases-f1d88fa6c1bf) | Documentation-style paper on all API layers and their on-chain correlates |
