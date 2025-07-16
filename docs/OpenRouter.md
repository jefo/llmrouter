---
title: Usage Accounting
headline: Usage Accounting | Track AI Model Usage with OpenRouter
canonical-url: 'https://openrouter.ai/docs/use-cases/usage-accounting'
'og:site_name': OpenRouter Documentation
'og:title': Usage Accounting - Track AI Model Token Usage
'og:description': >-
  Learn how to track AI model usage including prompt tokens, completion tokens,
  and cached tokens without additional API calls.
'og:image':
  type: url
  value: >-
    https://openrouter.ai/dynamic-og?title=Usage%20Accounting&description=Track%20AI%20model%20token%20usage%20with%20OpenRouter
'og:image:width': 1200
'og:image:height': 630
'twitter:card': summary_large_image
'twitter:site': '@OpenRouterAI'
noindex: false
nofollow: false
---

import { API_KEY_REF, Model } from '../../../imports/constants';

The OpenRouter API provides built-in **Usage Accounting** that allows you to track AI model usage without making additional API calls. This feature provides detailed information about token counts, costs, and caching status directly in your API responses.

## Usage Information

When enabled, the API will return detailed usage information including:

1. Prompt and completion token counts using the model's native tokenizer
2. Cost in credits
3. Reasoning token counts (if applicable)
4. Cached token counts (if available)

This information is included in the last SSE message for streaming responses, or in the complete response for non-streaming requests.

## Enabling Usage Accounting

You can enable usage accounting in your requests by including the `usage` parameter:

```json
{
  "model": "your-model",
  "messages": [],
  "usage": {
    "include": true
  }
}
```

## Response Format

When usage accounting is enabled, the response will include a `usage` object with detailed token information:

```json
{
  "object": "chat.completion.chunk",
  "usage": {
    "completion_tokens": 2,
    "completion_tokens_details": {
      "reasoning_tokens": 0
    },
    "cost": 0.95,
    "cost_details": {
      "upstream_inference_cost": 19
    },
    "prompt_tokens": 194,
    "prompt_tokens_details": {
      "cached_tokens": 0
    },
    "total_tokens": 196
  }
}
```

`cached_tokens` is the number of tokens that were _read_ from the cache. At this point in time, we do not support retrieving the number of tokens that were _written_ to the cache.

## Cost Breakdown

The usage response includes detailed cost information:

- `cost`: The total amount charged to your account
- `cost_details.upstream_inference_cost`: The actual cost charged by the upstream AI provider

**Note:** The `upstream_inference_cost` field only applies to BYOK (Bring Your Own Key) requests.

<Note title='Performance Impact'>
  Enabling usage accounting will add a few hundred milliseconds to the last
  response as the API calculates token counts and costs. This only affects the
  final message and does not impact overall streaming performance.
</Note>

## Benefits

1. **Efficiency**: Get usage information without making separate API calls
2. **Accuracy**: Token counts are calculated using the model's native tokenizer
3. **Transparency**: Track costs and cached token usage in real-time
4. **Detailed Breakdown**: Separate counts for prompt, completion, reasoning, and cached tokens

## Best Practices

1. Enable usage tracking when you need to monitor token consumption or costs
2. Account for the slight delay in the final response when usage accounting is enabled
3. Consider implementing usage tracking in development to optimize token usage before production
4. Use the cached token information to optimize your application's performance

## Alternative: Getting Usage via Generation ID

You can also retrieve usage information asynchronously by using the generation ID returned from your API calls. This is particularly useful when you want to fetch usage statistics after the completion has finished or when you need to audit historical usage.

To use this method:

1. Make your chat completion request as normal
2. Note the `id` field in the response
3. Use that ID to fetch usage information via the `/generation` endpoint

For more details on this approach, see the [Get a Generation](/docs/api-reference/get-a-generation) documentation.

## Examples

### Basic Usage with Token Tracking

<Template data={{
  API_KEY_REF,
  MODEL: "anthropic/claude-3-opus"
}}>
<CodeGroup>

```python Python
import requests
import json

url = "https://openrouter.ai/api/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {{API_KEY_REF}}",
    "Content-Type": "application/json"
}
payload = {
    "model": "{{MODEL}}",
    "messages": [
        {"role": "user", "content": "What is the capital of France?"}
    ],
    "usage": {
        "include": True
    }
}

response = requests.post(url, headers=headers, data=json.dumps(payload))
print("Response:", response.json()['choices'][0]['message']['content'])
print("Usage Stats:", response.json()['usage'])
```

```typescript TypeScript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: '{{API_KEY_REF}}',
});

async function getResponseWithUsage() {
  const response = await openai.chat.completions.create({
    model: '{{MODEL}}',
    messages: [
      {
        role: 'user',
        content: 'What is the capital of France?',
      },
    ],
    extra_body: {
      usage: {
        include: true,
      },
    },
  });

  console.log('Response:', response.choices[0].message.content);
  console.log('Usage Stats:', response.usage);
}

getResponseWithUsage();
```

</CodeGroup>
</Template>

### Streaming with Usage Information

This example shows how to handle usage information in streaming mode:

<Template data={{
  API_KEY_REF,
  MODEL: "anthropic/claude-3-opus"
}}>
<CodeGroup>

```python Python
from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="{{API_KEY_REF}}",
)

def chat_completion_with_usage(messages):
    response = client.chat.completions.create(
        model="{{MODEL}}",
        messages=messages,
        usage={
          "include": True
        },
        stream=True
    )
    return response

for chunk in chat_completion_with_usage([
    {"role": "user", "content": "Write a haiku about Paris."}
]):
    if hasattr(chunk, 'usage'):
        if hasattr(chunk.usage, 'total_tokens'):
            print(f"\nUsage Statistics:")
            print(f"Total Tokens: {chunk.usage.total_tokens}")
            print(f"Prompt Tokens: {chunk.usage.prompt_tokens}")
            print(f"Completion Tokens: {chunk.usage.completion_tokens}")
            print(f"Cost: {chunk.usage.cost} credits")
    elif chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

```typescript TypeScript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: '{{API_KEY_REF}}',
});

async function chatCompletionWithUsage(messages) {
  const response = await openai.chat.completions.create({
    model: '{{MODEL}}',
    messages,
    usage: {
      include: true,
    },
    stream: true,
  });

  return response;
}

(async () => {
  for await (const chunk of chatCompletionWithUsage([
    { role: 'user', content: 'Write a haiku about Paris.' },
  ])) {
    if (chunk.usage) {
      console.log('\nUsage Statistics:');
      console.log(`Total Tokens: ${chunk.usage.total_tokens}`);
      console.log(`Prompt Tokens: ${chunk.usage.prompt_tokens}`);
      console.log(`Completion Tokens: ${chunk.usage.completion_tokens}`);
      console.log(`Cost: ${chunk.usage.cost} credits`);
    } else if (chunk.choices[0].delta.content) {
      process.stdout.write(chunk.choices[0].delta.content);
    }
  }
})();
```

</CodeGroup>
</Template>

---
title: User Tracking
headline: User Tracking | Track Your Users with OpenRouter
canonical-url: 'https://openrouter.ai/docs/use-cases/user-tracking'
'og:site_name': OpenRouter Documentation
'og:title': User Tracking - Track Your Own User IDs with OpenRouter
'og:description': >-
  Learn how to use the user parameter to track your own user IDs with
  OpenRouter. Improve caching performance and get detailed reporting on your
  sub-users.
'og:image':
  type: url
  value: >-
    https://openrouter.ai/dynamic-og?title=User%20Tracking&description=Track%20your%20own%20user%20IDs%20with%20OpenRouter
'og:image:width': 1200
'og:image:height': 630
'twitter:card': summary_large_image
'twitter:site': '@OpenRouterAI'
noindex: false
nofollow: false
---

import { API_KEY_REF, Model } from '../../../imports/constants';

The OpenRouter API supports **User Tracking** through the optional `user` parameter, allowing you to track your own user IDs and improve your application's performance and reporting capabilities.

## What is User Tracking?

User tracking enables you to specify an arbitrary string identifier for your end-users in API requests. This optional metadata helps OpenRouter understand your sub-users, leading to several benefits:

1. **Improved Caching**: OpenRouter can make caches sticky to your individual users, improving load-balancing and throughput
2. **Enhanced Reporting**: View detailed analytics and activity feeds broken down by your user IDs

## How It Works

Simply include a `user` parameter in your API requests with any string identifier that represents your end-user. This could be a user ID, email hash, session identifier, or any other stable identifier you use in your application.

```json
{
  "model": "openai/gpt-4o",
  "messages": [
    {"role": "user", "content": "Hello, how are you?"}
  ],
  "user": "user_12345"
}
```

## Benefits

### Improved Caching Performance

When you consistently use the same user identifier for a specific user, OpenRouter can optimize caching to be "sticky" to that user. This means:

- A given user of your application (assuming you are using caching) will always get routed to the same provider and the cache will stay warm
- But separate users can be spread over different providers, improving load-balancing and throughput

### Enhanced Reporting and Analytics

The user parameter is available in the /activity page, in the exports from that page, and in the /generations API.

- **Activity Feed**: View requests broken down by user ID in your OpenRouter dashboard
- **Usage Analytics**: Understand which users are making the most requests
- **Export Data**: Get detailed exports that include user-level breakdowns

## Implementation Example

<Template data={{
  API_KEY_REF,
  MODEL: "openai/gpt-4o"
}}>
<CodeGroup>

```python Python
import requests
import json

url = "https://openrouter.ai/api/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {{API_KEY_REF}}",
    "Content-Type": "application/json"
}
payload = {
    "model": "{{MODEL}}",
    "messages": [
        {"role": "user", "content": "What's the weather like today?"}
    ],
    "user": "user_12345"  # Your user identifier
}

response = requests.post(url, headers=headers, data=json.dumps(payload))
print(response.json()['choices'][0]['message']['content'])
```

```typescript TypeScript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: '{{API_KEY_REF}}',
});

async function chatWithUserTracking() {
  const response = await openai.chat.completions.create({
    model: '{{MODEL}}',
    messages: [
      {
        role: 'user',
        content: "What's the weather like today?",
      },
    ],
    user: 'user_12345', // Your user identifier
  });

  console.log(response.choices[0].message.content);
}

chatWithUserTracking();
```

</CodeGroup>
</Template>

## Best Practices

### Choose Stable Identifiers

Use consistent, stable identifiers for the same user across requests:

- **Good**: `user_12345`, `customer_abc123`, `account_xyz789`
- **Avoid**: Random strings that change between requests

### Consider Privacy

When using user identifiers, consider privacy implications:

- Use internal user IDs rather than exposing personal information
- Avoid including personally identifiable information in user identifiers
- Consider using anonymized identifiers for better privacy protection

### Be Consistent

Use the same user identifier format throughout your application:

```python
# Consistent format
user_id = f"app_{internal_user_id}"
```
