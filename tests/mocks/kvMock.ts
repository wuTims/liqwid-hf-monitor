/**
 * Mock implementation of Cloudflare KV storage for testing
 */

// Define Cloudflare Workers KV types for testing
interface KVNamespaceGetOptions<Type> {
  type: Type;
  cacheTtl?: number;
}

interface KVNamespacePutOptions {
  expiration?: number;
  expirationTtl?: number;
  metadata?: Record<string, unknown>;
}

interface KVNamespaceListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

interface KVNamespaceListResult<T> {
  keys: { name: string; expiration?: number; metadata?: T }[];
  list_complete: boolean;
  cursor?: string;
}

interface KVNamespace {
  get(key: string, options?: Partial<KVNamespaceGetOptions<any>>): Promise<any>;
  getWithMetadata(key: string, options?: Partial<KVNamespaceGetOptions<any>>): Promise<{ value: any; metadata: Record<string, unknown> | null }>;
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: KVNamespacePutOptions): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: KVNamespaceListOptions): Promise<KVNamespaceListResult<unknown>>;
}

/**
 * Mock implementation of KVNamespace for testing
 * This simulates the behavior of Cloudflare KV storage without requiring a real KV namespace
 */
export class MockKVNamespace implements KVNamespace {
  private store: Map<string, string | ArrayBuffer | ReadableStream> = new Map();
  private metadata: Map<string, Record<string, unknown>> = new Map();

  /**
   * Get a value from the mock KV store
   */
  async get(key: string, options?: Partial<KVNamespaceGetOptions<undefined>>): Promise<string | null>;
  async get<ExpectedValue = unknown>(key: string, options?: Partial<KVNamespaceGetOptions<"json">>): Promise<ExpectedValue | null>;
  async get(key: string, options?: Partial<KVNamespaceGetOptions<"text">>): Promise<string | null>;
  async get(key: string, options?: Partial<KVNamespaceGetOptions<"arrayBuffer">>): Promise<ArrayBuffer | null>;
  async get(key: string, options?: Partial<KVNamespaceGetOptions<"stream">>): Promise<ReadableStream | null>;
  async get(key: string, options?: Partial<KVNamespaceGetOptions<any>>): Promise<any> {
    const value = this.store.get(key) || null;
    
    if (value === null) {
      return null;
    }
    
    if (options?.type === 'json' && typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        return null;
      }
    }
    
    return value;
  }

  /**
   * Get with metadata from the mock KV store
   */
  async getWithMetadata(key: string, options?: Partial<KVNamespaceGetOptions<undefined>>): Promise<{ value: string | null; metadata: Record<string, unknown> | null }>;
  async getWithMetadata<ExpectedValue = unknown>(key: string, options?: Partial<KVNamespaceGetOptions<"json">>): Promise<{ value: ExpectedValue | null; metadata: Record<string, unknown> | null }>;
  async getWithMetadata(key: string, options?: Partial<KVNamespaceGetOptions<"text">>): Promise<{ value: string | null; metadata: Record<string, unknown> | null }>;
  async getWithMetadata(key: string, options?: Partial<KVNamespaceGetOptions<"arrayBuffer">>): Promise<{ value: ArrayBuffer | null; metadata: Record<string, unknown> | null }>;
  async getWithMetadata(key: string, options?: Partial<KVNamespaceGetOptions<"stream">>): Promise<{ value: ReadableStream | null; metadata: Record<string, unknown> | null }>;
  async getWithMetadata(key: string, options?: Partial<KVNamespaceGetOptions<any>>): Promise<{ value: any; metadata: Record<string, unknown> | null }> {
    const value = await this.get(key, options);
    const metadata = this.metadata.get(key) || null;
    
    return { value, metadata };
  }

  /**
   * Put a value in the mock KV store
   */
  async put(key: string, value: string | ArrayBuffer | ReadableStream, options?: KVNamespacePutOptions): Promise<void> {
    this.store.set(key, value);
    
    if (options?.metadata) {
      this.metadata.set(key, options.metadata);
    }
  }

  /**
   * Delete a value from the mock KV store
   */
  async delete(key: string): Promise<void> {
    this.store.delete(key);
    this.metadata.delete(key);
  }

  /**
   * List keys in the mock KV store
   */
  async list(options?: KVNamespaceListOptions): Promise<KVNamespaceListResult<unknown>> {
    const keys = Array.from(this.store.keys()).map(name => {
      return {
        name,
        expiration: undefined,
        metadata: this.metadata.get(name) || undefined
      };
    });
    
    // Apply prefix filter if specified
    const filteredKeys = options?.prefix 
      ? keys.filter(key => key.name.startsWith(options.prefix || ''))
      : keys;
    
    // Apply cursor and limit
    const startIndex = options?.cursor ? parseInt(options.cursor, 10) : 0;
    const limit = options?.limit || 1000;
    const endIndex = Math.min(startIndex + limit, filteredKeys.length);
    
    const result = filteredKeys.slice(startIndex, endIndex);
    
    // Set cursor for next page if there are more results
    const cursor = endIndex < filteredKeys.length ? endIndex.toString() : undefined;
    
    return {
      keys: result,
      list_complete: cursor === undefined,
      cursor
    };
  }
}

/**
 * Create a new mock KV namespace for testing
 */
export function createMockKVNamespace(): MockKVNamespace {
  return new MockKVNamespace();
}
