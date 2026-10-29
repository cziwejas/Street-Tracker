import Dexie from 'dexie'

export class StreetTrackerDB extends Dexie {
  constructor() {
    super('StreetTracker')

    // Reserve version 1 without introducing tables or a domain model yet.
    this.version(1).stores({})
  }
}

export const db: StreetTrackerDB = new StreetTrackerDB()
