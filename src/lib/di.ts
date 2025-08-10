import Bottle from "bottlejs";

let container = new Bottle();
const PORT_ID_SYMBOL = Symbol("portId");

// A registry to store all defined ports.
// Key - portId, Value - the port object itself for debugging.
const portRegistry = new Map<string, Port<any>>();

/**
 * A unique descriptor object for a port.
 * This is just a "tag" or a "key", not a real function.
 */
export interface Port<T extends (...args: any[]) => any> {
	// This signature is here to maintain type compatibility with the adapter function.
	(...args: Parameters<T>): ReturnType<T>;
	[PORT_ID_SYMBOL]?: string;
}

/**
 * Defines a new port in the system.
 * This function only creates and registers a "contract" (interface),
 * but does not provide any implementation.
 * @returns Port<T> - A unique port descriptor.
 */
export function createPort<T extends (...args: any[]) => any>(): Port<T> {
	const portId = crypto.randomUUID();

	// Create a placeholder function that will serve as the port descriptor.
	// It is not intended to be called directly.
	const port = (() => {
		throw new Error(
			`Port with ID "${portId}" is an interface and cannot be called directly. ` +
				`Use setPortAdapter() to provide an implementation.`,
		);
	}) as Port<T>;

	port[PORT_ID_SYMBOL] = portId;

	// Register the port in our internal registry.
	portRegistry.set(portId, port);

	return port;
}

/**
 * Binds a specific implementation (adapter) to a port.
 * Only this function registers anything in the DI container.
 * @param port - The port descriptor created via createPort().
 * @param adapter - The implementation function matching the port's signature.
 */
export function setPortAdapter<T extends (...args: any[]) => any>(
	port: Port<T>,
	adapter: T,
): void {
	const portId = port[PORT_ID_SYMBOL];
	if (!portId || !portRegistry.has(portId)) {
		throw new Error("An invalid or unregistered port was provided.");
	}

	// Now, register the new implementation as a factory.
	container.factory(portId, () => adapter);
}

/**
 * Retrieves a port's implementation from the DI container.
 * @param port - The port descriptor for which to retrieve the implementation.
 * @returns T - The implementation function (adapter).
 */
export function usePort<T extends (...args: any[]) => any>(port: Port<T>): T {
	const portId = port[PORT_ID_SYMBOL];
	if (!portId || !portRegistry.has(portId)) {
		throw new Error("Attempted to use an invalid or unregistered port.");
	}

	const implementation = container.container[portId];
	if (!implementation) {
		throw new Error(
			`No implementation found for the port. Did you forget to call setPortAdapter()?`,
		);
	}

	return implementation;
}

/**
 * Resets the state of the DI container and port registry.
 * Necessary for test isolation.
 */
export function resetDI() {
	container = new Bottle();
}
