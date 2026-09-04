import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

/**
 * One-time utility script to completely purge all documents from a Firestore collection.
 * This is useful for clearing out seed or demo data before going to production.
 * 
 * @param collectionName The name of the collection to purge (defaults to 'it_projects')
 */
export async function purgeAllProjects(collectionName: string = 'it_projects') {
  console.log(`[Purge Script] Starting purge of collection: ${collectionName}...`);
  
  try {
    const q = collection(db, collectionName);
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log(`[Purge Script] Collection '${collectionName}' is already empty. Nothing to do.`);
      return;
    }

    console.log(`[Purge Script] Found ${snapshot.size} documents to delete. Processing...`);

    // Firestore batches have a hard limit of 500 operations per batch
    const BATCH_SIZE = 500;
    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = docs.slice(i, i + BATCH_SIZE);

      chunk.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`[Purge Script] Deleted chunk ${Math.floor(i / BATCH_SIZE) + 1} (${chunk.length} documents)`);
    }

    console.log(`[Purge Script] Successfully purged all documents from '${collectionName}'. System is ready for production.`);
  } catch (error) {
    console.error(`[Purge Script] Critical error purging collection '${collectionName}':`, error);
    throw error;
  }
}
