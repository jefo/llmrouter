import { z } from 'zod';
import { deepFreeze } from './utils'; // We will create this utility

/**
 * A factory function that creates a Value Object class.
 * Value Objects are defined by their attributes and are immutable.
 *
 * @param schema - The Zod schema defining the shape and validation of the VO.
 * @returns A class for the Value Object.
 */
export function createValueObject<T extends z.ZodTypeAny>(
  schema: T
) {
  type Props = z.infer<T>;

  return class ValueObject {
    public readonly props: Readonly<Props>;

    private constructor(props: Props) {
      // Deep freeze the properties to ensure true immutability
      this.props = deepFreeze(props);
    }

    /**
     * The only public way to create an instance of the Value Object.
     * It validates the input data against the schema.
     * @param data - The raw data for creating the VO.
     */
    public static create(data: unknown): ValueObject {
      return new ValueObject(schema.parse(data));
    }

    /**
     * Checks for structural equality against another Value Object.
     * @param other - The other Value Object to compare with.
     */
    public equals(other?: ValueObject): boolean {
      if (other === null || other === undefined) {
        return false;
      }
      // A simple but effective way to check for deep equality.
      return JSON.stringify(this.props) === JSON.stringify(other.props);
    }
  };
}
