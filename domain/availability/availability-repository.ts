import type { Availability, AvailabilityInput } from "./availability-types";

export interface AvailabilityRepository {
  findByUserId(userId: string): Promise<Availability[]>;
  findById(userId: string, id: string): Promise<Availability | null>;
  create(userId: string, input: AvailabilityInput): Promise<Availability>;
  update(userId: string, id: string, input: AvailabilityInput): Promise<Availability | null>;
  delete(userId: string, id: string): Promise<boolean>;
}
