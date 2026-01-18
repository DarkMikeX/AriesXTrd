# Trading Bot API Documentation

## Overview

The Telegram Trading Bot provides a REST API for external integrations and advanced functionality.

## Base URL

```
https://your-domain.com/api/v1
```

## Authentication

All API requests require authentication via Bearer token:

```
Authorization: Bearer YOUR_API_TOKEN
```

## Endpoints

### Trading Endpoints

#### GET /api/v1/trades
Get user's trading history.

**Parameters:**
- `userId` (required): Telegram user ID
- `limit` (optional): Number of trades to return (default: 10)
- `offset` (optional): Pagination offset (default: 0)
- `status` (optional): Filter by status (OPEN, CLOSED, PENDING)

**Response:**
```json
{
  "success": true,
  "data": {
    "trades": [
      {
        "id": 123,
        "asset": "AAPL",
        "direction": "CALL",
        "amount": 5.00,
        "entryPrice": 175.50,
        "exitPrice": 176.20,
        "result": "WIN",
        "profit": 4.75,
        "createdAt": "2025-01-11T14:40:15Z"
      }
    ],
    "total": 1,
    "limit": 10,
    "offset": 0
  }
}
```

#### POST /api/v1/trades
Execute a new trade.

**Request Body:**
```json
{
  "userId": 123456789,
  "asset": "AAPL",
  "direction": "CALL",
  "amount": 5.00,
  "expiryMinutes": 5
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tradeId": 456,
    "status": "PENDING",
    "message": "Trade queued for execution"
  }
}
```

#### GET /api/v1/trades/{id}
Get specific trade details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 456,
    "userId": 123456789,
    "asset": "AAPL",
    "direction": "CALL",
    "amount": 5.00,
    "entryPrice": 175.50,
    "exitPrice": 176.20,
    "result": "WIN",
    "profit": 4.75,
    "status": "CLOSED",
    "createdAt": "2025-01-11T14:40:15Z",
    "closedAt": "2025-01-11T14:45:15Z"
  }
}
```

### Analysis Endpoints

#### GET /api/v1/analysis/{symbol}
Get technical analysis for a symbol.

**Parameters:**
- `symbol` (required): Trading symbol (e.g., AAPL, EURUSD)
- `timeframe` (optional): Analysis timeframe (default: 15m)
- `userId` (optional): User ID for personalized analysis

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "AAPL",
    "currentPrice": 175.50,
    "signal": "BUY",
    "confidence": 85,
    "indicators": {
      "rsi": {
        "value": 42,
        "signal": "NEUTRAL"
      },
      "macd": {
        "signal": "BULLISH_CROSSOVER"
      },
      "bollingerBands": {
        "signal": "AT_LOWER_BAND"
      }
    },
    "timestamp": "2025-01-11T14:40:15Z"
  }
}
```

#### GET /api/v1/analysis/signals
Get latest trading signals.

**Parameters:**
- `limit` (optional): Number of signals to return (default: 10)
- `minConfidence` (optional): Minimum confidence level (default: 75)

**Response:**
```json
{
  "success": true,
  "data": {
    "signals": [
      {
        "symbol": "AAPL",
        "signal": "BUY",
        "confidence": 85,
        "timestamp": "2025-01-11T14:40:15Z"
      }
    ]
  }
}
```

### User Management Endpoints

#### GET /api/v1/users/{id}
Get user profile and statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123456789,
    "username": "john_doe",
    "totalTrades": 45,
    "winRate": 68.5,
    "totalProfit": 1250.75,
    "settings": {
      "autoTrading": false,
      "maxTradeAmount": 20,
      "dailyLossLimit": 50
    },
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

#### PUT /api/v1/users/{id}/settings
Update user settings.

**Request Body:**
```json
{
  "autoTrading": true,
  "maxTradeAmount": 25,
  "dailyLossLimit": 75
}
```

### Performance Endpoints

#### GET /api/v1/performance/{userId}
Get user performance statistics.

**Parameters:**
- `period` (optional): Time period (daily, weekly, monthly, all)

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "monthly",
    "totalTrades": 178,
    "wins": 121,
    "losses": 57,
    "winRate": 68.0,
    "totalProfit": 478.25,
    "totalInvested": 1250.00,
    "roi": 38.3,
    "bestTrade": 25.00,
    "worstTrade": -15.00,
    "averageTrade": 2.69
  }
}
```

#### GET /api/v1/performance/{userId}/chart
Get performance chart data.

**Response:**
```json
{
  "success": true,
  "data": {
    "labels": ["Jan", "Feb", "Mar", "Apr", "May"],
    "profit": [125.50, 89.25, 245.75, -45.20, 167.80],
    "cumulativeProfit": [125.50, 214.75, 460.50, 415.30, 583.10],
    "winRate": [65, 70, 72, 68, 71]
  }
}
```

### System Endpoints

#### GET /api/v1/health
Get system health status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 86400,
    "memory": {
      "used": 45600000,
      "total": 128000000,
      "percentage": 35.6
    },
    "database": {
      "status": "connected",
      "responseTime": 5
    },
    "services": {
      "telegram": "active",
      "iqoption": "active",
      "tradingview": "active"
    }
  }
}
```

#### GET /api/v1/stats
Get system statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 1250,
    "activeUsers": 89,
    "totalTrades": 15420,
    "activeTrades": 45,
    "systemLoad": 0.65,
    "memoryUsage": 72.3,
    "responseTime": 245
  }
}
```

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "amount",
      "reason": "must be greater than 0"
    }
  }
}
```

## Rate Limiting

API requests are rate limited:
- 100 requests per 15 minutes for regular endpoints
- 10 requests per minute for analysis endpoints
- 1000 requests per day for trading endpoints

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Webhooks

### Trade Updates Webhook

Configure webhook URL to receive real-time trade updates:

```json
{
  "event": "trade_update",
  "tradeId": 456,
  "userId": 123456789,
  "status": "CLOSED",
  "result": "WIN",
  "profit": 4.75,
  "timestamp": "2025-01-11T14:45:15Z"
}
```

### Signal Alerts Webhook

Receive trading signal notifications:

```json
{
  "event": "signal_alert",
  "symbol": "AAPL",
  "signal": "BUY",
  "confidence": 85,
  "timestamp": "2025-01-11T14:40:15Z"
}
```