import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { firstValueFrom, Observable } from 'rxjs';
import User = firebase.User;

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  user$: Observable<User | null>;

  constructor(private afAuth: AngularFireAuth) {
    this.user$ = this.afAuth.authState;

   }
  

  async login(email: string, password: string) {  
    await this.afAuth.signInWithEmailAndPassword(email, password);
    // Espera a que Firebase confirme sesión
    await firstValueFrom(this.afAuth.authState);
    
  }
  register(email: string, password: string) { 
    return this.afAuth.createUserWithEmailAndPassword(email, password);
  } 
  getCurrentUser(){

    return this.afAuth.currentUser;
  }
  

  authState$() {
    return this.afAuth.authState;
  }

  logout() {  
    return this.afAuth.signOut();
  } 
  async getIdToken(): Promise<string> {
  const user = await this.afAuth.currentUser;
  if (!user) throw new Error('No hay usuario autenticado');
  return user.getIdToken();
}
  async getToken(): Promise<string | null> {
    const user = await this.afAuth.currentUser;
    return user ? user.getIdToken() : null;
  }
}
