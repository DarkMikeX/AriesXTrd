# Telegram Bot Commands Reference

## Overview

The Trading Bot supports various commands for trading, analysis, and management. All commands work through Telegram chat interface.

## Command Categories

### 🤖 **Core Commands**

#### `/start`
**Description:** Initialize the bot and show main menu
**Usage:** `/start`
**Response:** Welcome message with main menu buttons

#### `/help`
**Description:** Show available commands and usage information
**Usage:** `/help [topic]`
**Examples:**
- `/help` - General help
- `/help trading` - Trading-specific help
- `/help settings` - Settings help
**Response:** Comprehensive help information

#### `/status`
**Description:** Check system status and health
**Usage:** `/status`
**Response:** System health, uptime, active trades, etc.

### 📊 **Analysis Commands**

#### `/analyze` or `/a`
**Description:** Analyze a trading asset
**Usage:** `/analyze <symbol>` or `/a <symbol>`
**Examples:**
- `/analyze AAPL` - Analyze Apple stock
- `/analyze EURUSD` - Analyze Euro/Dollar forex
- `/analyze BTCUSD` - Analyze Bitcoin
**Response:** Complete technical analysis with signals

#### `/signals` or `/s`
**Description:** View latest trading signals
**Usage:** `/signals [limit]` or `/s [limit]`
**Examples:**
- `/signals` - Show latest 5 signals
- `/signals 10` - Show latest 10 signals
**Response:** List of recent trading signals with confidence

#### `/chart` or `/c`
**Description:** View technical charts
**Usage:** `/chart <symbol> [timeframe]` or `/c <symbol> [timeframe]`
**Examples:**
- `/chart AAPL` - Daily chart for Apple
- `/chart EURUSD 1h` - 1-hour chart for EUR/USD
**Response:** ASCII chart representation

### 💰 **Trading Commands**

#### `/balance` or `/bal`
**Description:** Check account balance
**Usage:** `/balance` or `/bal`
**Response:** Current balance, available funds, account status

#### `/trade` or `/t`
**Description:** Execute a trade
**Usage:** `/trade <symbol> <direction> <amount> [expiry]`
**Examples:**
- `/trade AAPL CALL 5` - Buy $5 Apple CALL for 5 minutes
- `/trade EURUSD PUT 10 15` - Sell $10 EUR/USD PUT for 15 minutes
**Directions:** `CALL`, `PUT`, `BUY`, `SELL`
**Response:** Trade confirmation and execution status

#### `/positions` or `/pos`
**Description:** View open positions
**Usage:** `/positions` or `/pos`
**Response:** List of all open trades with P&L

#### `/close`
**Description:** Close an open position
**Usage:** `/close <tradeId>`
**Examples:**
- `/close 123` - Close trade with ID 123
**Response:** Position closure confirmation

#### `/cancel`
**Description:** Cancel a pending trade
**Usage:** `/cancel <tradeId>`
**Examples:**
- `/cancel 123` - Cancel pending trade 123
**Response:** Cancellation confirmation

### 📈 **Performance Commands**

#### `/stats` or `/st`
**Description:** View trading statistics
**Usage:** `/stats [period]` or `/st [period]`
**Examples:**
- `/stats` - Today's statistics
- `/stats week` - Weekly statistics
- `/stats month` - Monthly statistics
**Periods:** `today`, `week`, `month`, `all`
**Response:** Comprehensive performance metrics

#### `/history` or `/h`
**Description:** View trade history
**Usage:** `/history [limit] [status]` or `/h [limit] [status]`
**Examples:**
- `/history` - Last 5 trades
- `/history 10` - Last 10 trades
- `/history 5 won` - Last 5 winning trades
**Statuses:** `won`, `lost`, `open`, `closed`, `all`
**Response:** Paginated trade history

#### `/performance` or `/perf`
**Description:** Detailed performance analytics
**Usage:** `/performance [metric]` or `/perf [metric]`
**Examples:**
- `/performance` - General performance overview
- `/performance winrate` - Win rate analysis
- `/performance profit` - Profit/loss analysis
**Metrics:** `winrate`, `profit`, `drawdown`, `sharpe`, `all`
**Response:** Advanced performance metrics and charts

### ⚙️ **Settings Commands**

#### `/settings` or `/set`
**Description:** Manage bot settings
**Usage:** `/settings` or `/set`
**Response:** Settings menu with configuration options

#### `/risk`
**Description:** View risk management settings
**Usage:** `/risk`
**Response:** Current risk parameters and limits

#### `/limits`
**Description:** Check trading limits
**Usage:** `/limits`
**Response:** Daily limits, position sizes, etc.

#### `/preferences` or `/prefs`
**Description:** Set trading preferences
**Usage:** `/preferences` or `/prefs`
**Examples:**
- `/preferences assets stocks,forex` - Set preferred assets
- `/preferences notifications off` - Disable notifications
**Response:** Updated preferences confirmation

### 🚨 **Safety Commands**

#### `/stop`
**Description:** Emergency stop all trading
**Usage:** `/stop`
**Response:** Trading halt confirmation (requires confirmation)

#### `/resume`
**Description:** Resume trading after stop
**Usage:** `/resume`
**Response:** Trading resume confirmation

#### `/reset`
**Description:** Reset bot settings to defaults
**Usage:** `/reset`
**Examples:**
- `/reset settings` - Reset user settings
- `/reset stats` - Reset statistics (requires confirmation)
**Response:** Reset confirmation

### 👥 **Social Commands**

#### `/leaderboard` or `/lb`
**Description:** View trading leaderboard
**Usage:** `/leaderboard [period]` or `/lb [period]`
**Examples:**
- `/leaderboard` - Overall leaderboard
- `/leaderboard month` - Monthly leaderboard
**Periods:** `week`, `month`, `all`
**Response:** Top performers ranking

#### `/profile`
**Description:** View user profile
**Usage:** `/profile [user]`
**Examples:**
- `/profile` - Your own profile
- `/profile @username` - Another user's profile
**Response:** User statistics and achievements

#### `/achievements` or `/ach`
**Description:** View unlocked achievements
**Usage:** `/achievements` or `/ach`
**Response:** Achievement badges and progress

### 🔧 **Administrative Commands**

#### `/admin`
**Description:** Administrative functions (admin only)
**Usage:** `/admin <command> [params]`
**Examples:**
- `/admin stats` - System statistics
- `/admin users` - User management
- `/admin broadcast <message>` - Send broadcast message
**Response:** Admin panel or command result

#### `/maintenance`
**Description:** Maintenance mode (admin only)
**Usage:** `/maintenance <on|off> [message]`
**Response:** Maintenance mode status

#### `/backup`
**Description:** Create system backup (admin only)
**Usage:** `/backup`
**Response:** Backup creation status

### 💬 **Interactive Commands**

#### `/menu`
**Description:** Show main menu
**Usage:** `/menu`
**Response:** Main navigation menu

#### `/quick`
**Description:** Quick actions menu
**Usage:** `/quick`
**Response:** Fast access to common actions

#### `/tutorial`
**Description:** Interactive tutorial
**Usage:** `/tutorial [step]`
**Examples:**
- `/tutorial` - Start tutorial
- `/tutorial 2` - Go to tutorial step 2
**Response:** Guided tutorial steps

### 📱 **Asset Commands**

#### `/stocks`
**Description:** Show stock menu
**Usage:** `/stocks`
**Response:** Popular stocks selection menu

#### `/forex`
**Description:** Show forex menu
**Usage:** `/forex`
**Response:** Major currency pairs menu

#### `/crypto`
**Description:** Show crypto menu
**Usage:** `/crypto`
**Response:** Popular cryptocurrencies menu

#### `/search`
**Description:** Search for assets
**Usage:** `/search <query>`
**Examples:**
- `/search apple` - Search for Apple-related assets
- `/search tech` - Search for technology stocks
**Response:** Asset search results

### 🔄 **Utility Commands**

#### `/export`
**Description:** Export data
**Usage:** `/export <type> [format]`
**Examples:**
- `/export trades csv` - Export trades as CSV
- `/export stats json` - Export statistics as JSON
**Types:** `trades`, `stats`, `performance`, `settings`
**Formats:** `csv`, `json`, `pdf`
**Response:** Data export link or file

#### `/import`
**Description:** Import data
**Usage:** `/import <type>`
**Examples:**
- `/import settings` - Import settings backup
**Response:** Import confirmation

#### `/backup`
**Description:** Create personal backup
**Usage:** `/backup`
**Response:** Backup creation confirmation

#### `/restore`
**Description:** Restore from backup
**Usage:** `/restore`
**Response:** Restore confirmation

## Command Aliases

The bot supports command aliases for convenience:

| Full Command | Aliases |
|-------------|---------|
| `/analyze` | `/a`, `/analyse` |
| `/balance` | `/bal`, `/b` |
| `/stats` | `/st`, `/statistics` |
| `/trade` | `/t` |
| `/positions` | `/pos`, `/p` |
| `/settings` | `/set`, `/config` |
| `/performance` | `/perf`, `/p` |
| `/leaderboard` | `/lb`, `/rankings` |

## Inline Commands

You can also use commands directly in chat messages:

- `AAPL` - Analyze Apple stock
- `EURUSD CALL 5` - Execute EUR/USD CALL trade
- `balance` - Check balance
- `stats` - View statistics

## Error Handling

### Common Error Messages

- **"Symbol not found"** - Invalid asset symbol
- **"Insufficient balance"** - Not enough funds for trade
- **"Daily limit reached"** - Trading limit exceeded
- **"Risk check failed"** - Trade violates risk rules
- **"Analysis failed"** - Unable to analyze asset
- **"Trade execution failed"** - IQ Option connection issue

### Error Recovery

- **Retry commands** after fixing the issue
- **Check `/status`** for system health
- **Use `/help`** for command guidance
- **Contact support** for persistent issues

## Rate Limits

- **Analysis commands:** 10 per minute
- **Trading commands:** 5 per minute
- **Status/info commands:** Unlimited
- **Admin commands:** 100 per hour

Rate limit violations result in temporary command blocking.

## Command History

- Recent commands are stored and accessible via `/history`
- Command suggestions appear based on usage patterns
- Auto-completion for asset symbols after typing `/analyze `