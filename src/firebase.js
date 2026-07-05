import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCJ-iX6p7JK-oN_L9UKuk9DroG1gt0oOIE",
  authDomain: "peachypixels-6e78d.firebaseapp.com",
  projectId: "peachypixels-6e78d",
  storageBucket: "peachypixels-6e78d.firebasestorage.app",
  messagingSenderId: "40621066191",
  appId: "1:40621066191:web:bc595e54cd1efa7e62f4ba",
  measurementId: "G-KHE48QGW0X"
};

const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);