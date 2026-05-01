export const SYSTEM_DESIGN_DEMO_PROJECT_TITLE = 'System Design Prep';
export const SYSTEM_DESIGN_DEMO_PROJECT_DESCRIPTION = 'Practice system design interview concepts with branchable AI tutor nodes.';
export const SYSTEM_DESIGN_DEMO_GRAPH_TITLE = 'Design a URL Shortener';
export const SYSTEM_DESIGN_DEMO_ROOT_KEY = 'root';
export const SYSTEM_DESIGN_DEMO_PROMPT_TEMPLATE_VERSION = 'knowflow-tutor-v0';
export const SYSTEM_DESIGN_DEMO_CONTEXT_POLICY_VERSION = 'current-node-selected-ancestor-v0';

export type SystemDesignDemoMessageSeed = {
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  tokenCount?: number;
};

export type SystemDesignDemoNodeSeed = {
  key: string;
  title: string;
  summary: string | null;
  layout: Record<string, number>;
  messages: SystemDesignDemoMessageSeed[];
};

export type SystemDesignDemoBranchSeed = {
  sourceKey: string;
  targetKey: string;
  sourceMessageSequence: number;
  selectedText: string;
  label: string | null;
};

export const SYSTEM_DESIGN_DEMO_NODES: SystemDesignDemoNodeSeed[] = [
  {
    key: 'root',
    title: "Design a URL Shortener",
    summary: "Start from the full URL shortener design and branch into interview subtopics.",
    layout: {"x":80,"y":180,"width":700,"height":460},
    messages: [
    {
      role: 'USER',
      content: `Design a URL shortener like bit.ly for a system design interview.`,
    },
    {
      role: 'ASSISTANT',
      content: `A good URL shortener design should cover API design, short-code generation, database schema, cache-aside strategy, redirect latency, rate limiting, and analytics.

API design: expose endpoints such as POST /urls to create a short link and GET /{code} to redirect users.

short-code generation: create compact unique codes with base62 encoding, random tokens with collision checks, or ID-based encoding.

database schema: store the short code, original URL, owner metadata, creation time, expiration time, and lookup indexes.

cache-aside strategy: keep hot short-code lookups in Redis or another cache. On a redirect, read from cache first, fall back to PostgreSQL, then populate the cache.

redirect latency: keep the redirect path extremely fast because it is the most frequent user-facing request.

rate limiting: protect URL creation and redirect abuse with per-IP or per-user limits.

analytics: collect click events, referrers, user agents, geography, and timestamps asynchronously so analytics does not slow down redirects.`,
      tokenCount: 258,
    }
    ],
  },
  {
    key: 'short-code-generation-concepts',
    title: "Branch: short-code generation concepts",
    summary: "short-code generation concepts",
    layout: {"x":1002.607204116638,"y":-427.1110433640652},
    messages: [
    {
      role: 'USER',
      content: `what is short-code generation`,
    },
    {
      role: 'ASSISTANT',
      content: `“Short-code generation” usually means **creating a short, compact code or identifier from a longer piece of data**.

Common examples:

- **URL short codes**: turning a long URL into something like \`abc123\`
- **Verification codes**: generating a short numeric or alphanumeric code for login/2FA
- **Reference IDs**: making a shorter token to represent a record, order, or user
- **Compressed naming**: generating brief codes for items, products, or files

How it works depends on the use case, but it often uses:
- **random generation**
- **hashing**
- **encoding**
- **mapping a long ID to a shorter token**

Example:
- Long URL: \`https://example.com/products/12345/details\`
- Short code: \`x7K9P2\`

If you want, I can explain:
1. **how to generate short codes in code**, or
2. **the different algorithms used for short-code generation**.`,
      tokenCount: 208,
    }
    ],
  },
  {
    key: 'short-code-generation-options',
    title: "Branch: short-code generation options",
    summary: "Explore options for creating compact, unique short codes.",
    layout: {"x":1014.093319871793,"y":-206.2177463675178},
    messages: [
    {
      role: 'USER',
      content: `what are the options to generate short-code`,
    },
    {
      role: 'ASSISTANT',
      content: `Here are the main options for generating **short codes**, depending on what you mean by “short-code”:

### 1. Random short code
Generate a code made of random characters.
- **Examples:** \`A7K2\`, \`9FQX1M\`, \`T4B8Z\`
- **Best for:** coupons, invite codes, temporary links
- **Pros:** simple, hard to guess
- **Cons:** can collide if the code space is too small

### 2. Sequential short code
Generate codes in order, then encode them into a shorter format.
- **Examples:** \`0001\`, \`0002\`, \`0003\`
- Often converted to **Base62** or similar to make them shorter.
- **Best for:** internal IDs, tickets, records
- **Pros:** easy to track
- **Cons:** predictable

### 3. Hash-based short code
Create a code from a hash of input data and then truncate it.
- **Examples:** \`X7P9Q2\`
- **Best for:** deterministic codes from URLs, emails, or IDs
- **Pros:** repeatable for same input
- **Cons:** possible collisions if too short

### 4. Base62 / Base36 encoded ID
Take a numeric ID and encode it using a larger character set.
- **Examples:** \`1Z\`, \`K9f\`, \`3xT7\`
- **Best for:** URL shorteners, compact identifiers
- **Pros:** compact, efficient
- **Cons:** usually requires a backend numeric ID

### 5. Human-friendly code
Generate short codes avoiding ambiguous characters like \`0/O\`, \`1/I/l\`.
- **Examples:** \`F7K9\`, \`M3X2\`
- **Best for:** user-entered codes
- **Pros:** easier to read and type
- **Cons:** slightly smaller character set

### 6. Domain-specific pattern
Use a format based on your business rules.
- **Examples:** \`AB-123\`, \`NYC7\`, \`XQ-9T\`
- **Best for:** support tickets, order numbers, vouchers
- **Pros:** meaningful and structured
- **Cons:** less random, may reveal information

### Common character sets
- **Base36:** \`0-9 + A-Z\`
- **Base62:** \`0-9 + A-Z + a-z\`
- **Crockford Base32:** readable, avoids confusing characters

### How to choose
- Need **easy typing**: human-friendly / Crockford Base32
- Need **compact IDs**: Base62 or sequential encoding
- Need **security/guess resistance**: random codes with enough length
- Need **same input → same code**: hash-based

If you want, I can also show:
1. **how to generate short codes in Python/JavaScript**, or
2. **which option is best for URL shorteners vs coupons vs invitation codes**.`,
      tokenCount: 618,
    },
    {
      role: 'USER',
      content: `which option is best for URL Shorteners`,
    },
    {
      role: 'ASSISTANT',
      content: `For **URL shorteners**, the best option is usually:

## **Sequential numeric ID + Base62 encoding**
This is the most common and practical choice.

### Why it’s best
- **Very compact**: short output like \`aZ3\`, \`k9P2\`
- **Fast to generate**
- **No collisions** if backed by a unique database ID
- **Easy to decode** back to the original record

### How it works
1. Save the long URL in a database with an auto-increment ID, e.g. \`12543\`
2. Convert that number to **Base62**
3. Use the encoded value as the short code

Example:
- \`12543\` → \`3dF\`
- Short URL: \`https://sho.rt/3dF\`

---

## Other options and why they’re less ideal

### 1. Random codes
Good if you want more unpredictability, but:
- you must check for collisions
- shorter codes can be guessed more easily if not long enough
- database lookups are still needed

### 2. Hash-based codes
Useful if the same URL should always generate the same code, but:
- collisions can happen
- not ideal if you need multiple short links for the same long URL
- harder to manage

### 3. Sequential plain IDs
Simple, but:
- too predictable
- easier to enumerate
- not as compact as Base62

---

## Recommendation
If you’re building a standard URL shortener:

- Use **auto-increment ID**
- Encode with **Base62**
- Keep the code length as short as possible while avoiding guessability concerns

If you want, I can also show:
- a **Base62 encoding example**
- a **database design for a URL shortener**
- or **how to generate short codes in Python/JavaScript**`,
      tokenCount: 386,
    }
    ],
  },
  {
    key: 'database-schema',
    title: "Branch: database schema",
    summary: "Model the tables and indexes needed for fast redirects.",
    layout: {"x":1002.648661604069,"y":47.43021816426796},
    messages: [
    {
      role: 'USER',
      content: `what is database schema`,
    },
    {
      role: 'ASSISTANT',
      content: `A **database schema** is the **blueprint or structure** of a database.

It defines things like:

- **Tables** — what data collections exist
- **Columns/fields** — what each table stores
- **Data types** — e.g. text, integer, date
- **Relationships** — how tables connect to each other
- **Constraints** — rules like “this value must be unique” or “cannot be null”

### Simple example
If you had a database for a school, the schema might include:

- **Students** table
  - \`student_id\` (integer)
  - \`name\` (text)
  - \`email\` (text)

- **Classes** table
  - \`class_id\` (integer)
  - \`class_name\` (text)

- **Enrollments** table
  - \`student_id\`
  - \`class_id\`

This schema describes the database structure, not the actual data inside it.

### In short
- **Schema = structure/design**
- **Data = actual stored information**

If you want, I can also explain the difference between **schema and database**, or show a **real SQL example**.`,
      tokenCount: 245,
    }
    ],
  },
  {
    key: 'sql',
    title: "Branch: SQL",
    summary: "SQL concepts",
    layout: {"x":1502.874221786132,"y":-28.29838965128886},
    messages: [
    {
      role: 'USER',
      content: `what is SQL`,
    },
    {
      role: 'ASSISTANT',
      content: `SQL stands for **Structured Query Language**. It’s the standard language used to **work with relational databases**.

With SQL, you can:

- **Create** databases and tables
- **Read** data using queries
- **Insert** new records
- **Update** existing records
- **Delete** records
- **Define** database structure and permissions

### Simple example
\`\`\`sql
SELECT name, email
FROM users
WHERE active = 1;
\`\`\`

This query means:
“Get the \`name\` and \`email\` of all users who are active.”

### Common SQL commands
- \`SELECT\` — retrieve data
- \`INSERT\` — add data
- \`UPDATE\` — change data
- \`DELETE\` — remove data
- \`CREATE TABLE\` — make a new table

### Why it matters
SQL is used by many applications to store and manage data efficiently, and it’s one of the most important skills in data, backend development, and analytics.

If you want, I can also explain:
- SQL vs NoSQL
- basic SQL syntax
- how SQL relates to database schemas`,
      tokenCount: 234,
    },
    {
      role: 'USER',
      content: `What are the alternatives to SQL`,
    },
    {
      role: 'ASSISTANT',
      content: `Alternatives to SQL usually depend on what you mean by “alternative”:

### 1. NoSQL databases
These are the most common alternatives to **relational databases + SQL**.

They include:
- **Document databases** like MongoDB
- **Key-value stores** like Redis
- **Column-family databases** like Cassandra
- **Graph databases** like Neo4j

These often use their own query methods or APIs instead of SQL.

### 2. Query languages for specific databases
Some databases use different languages or query styles, such as:
- **Cypher** for graph databases
- **MongoDB Query Language** for MongoDB
- **GraphQL** for APIs, not databases directly, but sometimes used in similar data-access contexts

### 3. Programmatic access
Instead of writing queries directly, some systems use:
- ORM tools like **Hibernate** or **SQLAlchemy**
- Database APIs or SDKs
- Direct code-based data access

### Important note
SQL is still the standard for **relational databases**, so these alternatives are often alternatives to the *database model* or *query style*, not always a complete replacement for SQL.

If you want, I can make a quick comparison table of **SQL vs NoSQL**.`,
      tokenCount: 261,
    }
    ],
  },
  {
    key: 'document-databases',
    title: "Branch: Document databases",
    summary: null,
    layout: {"x":2154.180780452868,"y":-139.9703872755554},
    messages: [
    {
      role: 'USER',
      content: `explain`,
    },
    {
      role: 'ASSISTANT',
      content: `A **document database** is a type of **NoSQL database** that stores data as **documents** instead of rows and columns.

### What that means
In a relational database, data is usually split into tables.
In a document database, each record is stored as a document, often in **JSON**, **BSON**, or **XML** format.

Example document:
\`\`\`json
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com",
  "skills": ["Python", "SQL"]
}
\`\`\`

### Key idea
Document databases are useful when:
- data is **semi-structured** or **nested**
- records can have **different fields**
- you want to change the structure easily without altering a strict schema

### How they differ from SQL databases
- **SQL databases** use a fixed schema with tables, columns, and relationships
- **Document databases** store flexible documents, so the structure can vary from one document to another

### Advantages
- flexible schema
- easy to store nested data
- often good for fast development
- convenient for hierarchical data

### Example use cases
- user profiles
- content management systems
- product catalogs
- event data

### Common document databases
- MongoDB
- CouchDB
- Firestore

If you want, I can also explain **how document databases compare to relational databases** in a simple table.`,
      tokenCount: 297,
    }
    ],
  },
  {
    key: 'key-value-stores',
    title: "Branch: Key-value stores",
    summary: null,
    layout: {"x":2183.610321871881,"y":96.48681384980759},
    messages: [
    {
      role: 'USER',
      content: `explain`,
    },
    {
      role: 'ASSISTANT',
      content: `A **key-value store** is a simple kind of database where data is stored as pairs:

- **key** = a unique identifier
- **value** = the data attached to that key

Example:

\`\`\`text
"user:123" -> "Alice"
"cart:456" -> ["apple", "milk", "bread"]
\`\`\`

## How it works
You use the **key** to quickly retrieve, update, or delete the **value**.
This makes key-value stores very fast and easy to use.

## Why it’s different from SQL databases
Since your branch comes from **database schema → SQL → Key-value stores**, the comparison is:

- **SQL databases** organize data into **tables, rows, and columns**
- **Key-value stores** do **not** enforce a fixed table schema
- In SQL, you usually query with joins and conditions
- In key-value stores, you mostly do direct lookup by key

## Benefits
- Very fast reads and writes
- Simple design
- Easy to scale horizontally
- Good for caching, sessions, user preferences, and simple lookups

## Limitations
- Harder to query by anything except the key
- No built-in joins like SQL
- Less structure and validation
- Not ideal for complex relationships

## Example use cases
- Session storage
- Caching
- Feature flags
- Shopping carts
- User settings

## Mental model
Think of a key-value store like a huge dictionary or map:

\`\`\`text
"theme" -> "dark"
"language" -> "en"
\`\`\`

If you want, I can also explain:
1. **how key-value stores differ from relational databases**
2. **common examples like Redis or DynamoDB**
3. **when to use a key-value store vs SQL**`,
      tokenCount: 374,
    }
    ],
  },
  {
    key: 'column-family-databases',
    title: "Branch: Column-family databases",
    summary: null,
    layout: {"x":2197.874887694569,"y":346.0149808622836},
    messages: [
    {
      role: 'USER',
      content: `explain`,
    },
    {
      role: 'ASSISTANT',
      content: `Column-family databases are a type of **NoSQL database** designed to store and retrieve data by **columns** rather than by rows.

### Core idea
In a traditional relational database, a row contains all values for one record:

| id | name | age | city |
|---|---|---:|---|
| 1 | Ana | 29 | Paris |

In a column-family database, data is organized into **column families** and often stored so that values for the same column are kept together. This makes it efficient to read or write only the columns you need.

### Why they’re useful
They are especially good for:
- **Large-scale data**
- **Fast reads/writes on specific fields**
- **Sparse data** where many rows don’t have the same columns
- **Distributed systems**

### Typical properties
- Flexible schema
- Can handle huge volumes of data
- Optimized for horizontal scaling
- Often used in big data and real-time applications

### Examples
Common column-family databases include:
- **Apache Cassandra**
- **HBase**
- **ScyllaDB**

### Simple intuition
If a row-based database is like storing information in **folders by person**, a column-family database is more like storing information in **folders by type of info**—all names together, all ages together, etc.

### Difference from SQL databases
SQL databases usually:
- have a fixed schema
- organize data in tables/rows
- are great for complex joins and transactions

Column-family databases:
- are more flexible
- are built for scale and speed
- usually avoid joins in favor of denormalized data

If you want, I can also explain:
1. how column-family databases differ from **row-oriented databases**, or
2. how **Cassandra** stores data internally.`,
      tokenCount: 374,
    }
    ],
  },
  {
    key: 'graph-databases',
    title: "Branch: Graph databases",
    summary: null,
    layout: {"x":2200.886784327327,"y":633.7175775843659},
    messages: [
    {
      role: 'USER',
      content: `explain`,
    },
    {
      role: 'ASSISTANT',
      content: `Graph databases are a type of database designed to store and query data as **nodes** and **relationships**.

### Core idea
Instead of organizing data in tables like SQL databases, a graph database models things as:
- **Nodes**: the entities, like people, products, cities
- **Edges/relationships**: the connections between them, like “knows,” “purchased,” “lives in”
- **Properties**: extra details on nodes or edges, like a person’s name or a relationship’s date

### Example
If you were modeling a social network:
- Node: \`Alice\`
- Node: \`Bob\`
- Relationship: \`Alice KNOWS Bob\`

You can also attach properties:
- \`Alice\` → \`{name: "Alice", age: 30}\`
- \`KNOWS\` → \`{since: 2022}\`

### Why use graph databases?
They are especially good when your data has lots of connections and you need to ask questions like:
- “Who are the friends of my friends?”
- “What’s the shortest path between these two nodes?”
- “Which products are connected through user behavior?”

Graph databases make these kinds of relationship-heavy queries efficient and intuitive.

### Compared to SQL databases
- **SQL**: data is organized into tables with rows and columns
- **Graph databases**: data is organized into connected nodes and edges

In SQL, relationships are usually represented with foreign keys and joins. In graph databases, relationships are first-class citizens, so traversing connections is often simpler and faster.

### Common use cases
- Social networks
- Recommendation engines
- Fraud detection
- Network/IT infrastructure
- Knowledge graphs

### Common query languages
Many graph databases use languages like:
- **Cypher** (Neo4j)
- **Gremlin**
- **SPARQL** for semantic graphs

If you want, I can also explain:
1. how graph databases differ from relational databases in more detail, or
2. how a graph query looks in practice.`,
      tokenCount: 417,
    }
    ],
  },
  {
    key: 'cache-aside-strategy',
    title: "Branch: cache-aside strategy",
    summary: "Understand how cache-aside keeps hot redirects fast.",
    layout: {"x":1021.189821294157,"y":268.1816141477141},
    messages: [

    ],
  },
  {
    key: 'redirect-latency',
    title: "Branch: redirect latency",
    summary: "Reason about latency on the most important read path.",
    layout: {"x":1004.819980393118,"y":483.7651709757818},
    messages: [

    ],
  },
  {
    key: 'rate-limiting',
    title: "Branch: rate limiting",
    summary: "Protect creation and redirect endpoints from abuse.",
    layout: {"x":1023.193145690033,"y":733.4636950772096},
    messages: [

    ],
  },
  {
    key: 'analytics',
    title: "Branch: analytics",
    summary: "Collect useful click data without slowing redirects.",
    layout: {"x":1004.819980393118,"y":1008.162633650316},
    messages: [

    ],
  }
];

export const SYSTEM_DESIGN_DEMO_BRANCHES: SystemDesignDemoBranchSeed[] = [
  {
    sourceKey: 'root',
    targetKey: 'short-code-generation-options',
    sourceMessageSequence: 1,
    selectedText: "short-code generation",
    label: "short-code generation",
  },
  {
    sourceKey: 'root',
    targetKey: 'database-schema',
    sourceMessageSequence: 1,
    selectedText: "database schema",
    label: "database schema",
  },
  {
    sourceKey: 'root',
    targetKey: 'cache-aside-strategy',
    sourceMessageSequence: 1,
    selectedText: "cache-aside strategy",
    label: "cache-aside strategy",
  },
  {
    sourceKey: 'root',
    targetKey: 'redirect-latency',
    sourceMessageSequence: 1,
    selectedText: "redirect latency",
    label: "redirect latency",
  },
  {
    sourceKey: 'root',
    targetKey: 'rate-limiting',
    sourceMessageSequence: 1,
    selectedText: "rate limiting",
    label: "rate limiting",
  },
  {
    sourceKey: 'root',
    targetKey: 'analytics',
    sourceMessageSequence: 1,
    selectedText: "analytics",
    label: "analytics",
  },
  {
    sourceKey: 'root',
    targetKey: 'short-code-generation-concepts',
    sourceMessageSequence: 1,
    selectedText: "short-code generation",
    label: "short-code generation",
  },
  {
    sourceKey: 'database-schema',
    targetKey: 'sql',
    sourceMessageSequence: 1,
    selectedText: "SQL",
    label: "SQL",
  },
  {
    sourceKey: 'sql',
    targetKey: 'document-databases',
    sourceMessageSequence: 3,
    selectedText: "Document databases",
    label: "Document databases",
  },
  {
    sourceKey: 'sql',
    targetKey: 'key-value-stores',
    sourceMessageSequence: 3,
    selectedText: "Key-value stores",
    label: "Key-value stores",
  },
  {
    sourceKey: 'sql',
    targetKey: 'column-family-databases',
    sourceMessageSequence: 3,
    selectedText: "Column-family databases",
    label: "Column-family databases",
  },
  {
    sourceKey: 'sql',
    targetKey: 'graph-databases',
    sourceMessageSequence: 3,
    selectedText: "Graph databases",
    label: "Graph databases",
  }
];
