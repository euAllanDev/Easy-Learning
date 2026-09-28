import { assertNoOverlap, sortAvailability, validateAvailability } from "@/domain/availability/availability-rules";
import type { AvailabilityRepository } from "@/domain/availability/availability-repository";
import type { AvailabilityInput } from "@/domain/availability/availability-types";

export class AvailabilityNotFoundError extends Error {
  constructor() {
    super("Horário não encontrado.");
  }
}

export class ListAvailability {
  constructor(private readonly repository: AvailabilityRepository) {}

  async execute(userId: string) {
    return sortAvailability(await this.repository.findByUserId(userId));
  }
}

export class CreateAvailability {
  constructor(private readonly repository: AvailabilityRepository) {}

  async execute(userId: string, input: AvailabilityInput) {
    const candidate = validateAvailability(input);
    assertNoOverlap(candidate, await this.repository.findByUserId(userId));
    return this.repository.create(userId, candidate);
  }
}

export class UpdateAvailability {
  constructor(private readonly repository: AvailabilityRepository) {}

  async execute(userId: string, id: string, input: Partial<AvailabilityInput>) {
    const current = await this.repository.findById(userId, id);
    if (!current) throw new AvailabilityNotFoundError();
    const candidate = validateAvailability({
      dayOfWeek: input.dayOfWeek ?? current.dayOfWeek,
      startTime: input.startTime ?? current.startTime,
      endTime: input.endTime ?? current.endTime,
    });
    assertNoOverlap(candidate, await this.repository.findByUserId(userId), id);
    const updated = await this.repository.update(userId, id, candidate);
    if (!updated) throw new AvailabilityNotFoundError();
    return updated;
  }
}

export class DeleteAvailability {
  constructor(private readonly repository: AvailabilityRepository) {}

  async execute(userId: string, id: string) {
    if (!(await this.repository.delete(userId, id))) throw new AvailabilityNotFoundError();
  }
}
