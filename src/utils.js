import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export const prependStringToFileName = (file, prependStr) => {
  const newFileName = `${prependStr}${file.name}`;
  return new File([file], newFileName, { type: file.type });
};

export const parseContractData = (content) => {
  const fields = {};
  const fieldRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let match;

  while ((match = fieldRegex.exec(content)) !== null) {
    fields[match[1]] = match[2].trim();
  }

  return fields;
};

export const saveDocuments = async (docs, columns) => {
  try {
    console.log('Saving documents to Firestore...');
    await setDoc(doc(db, 'legalAnalyzer', 'documents'), {
      documents: docs,
      columnOrder: columns,
    });
    console.log('Documents saved successfully');
  } catch (error) {
    console.error('Error saving documents:', error);
  }
};

export const loadDocuments = async (setDocuments, setColumnOrder) => {
  try {
    const docRef = doc(db, 'legalAnalyzer', 'documents');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      setDocuments(data.documents || []);
      setColumnOrder(data.columnOrder || []);
    } else {
      console.log('No such document!');
    }
  } catch (error) {
    console.error('Error loading documents:', error);
  }
};

