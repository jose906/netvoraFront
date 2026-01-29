import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../services/api.service';
import { user } from '../interfaces/users';
import { users } from '../interfaces/users';
import { AuthService } from '../services/auth.service';
// ajusta la ruta a tu interfaz

@Component({
  selector: 'app-administrador',
  templateUrl: './administrador.component.html',
  styleUrls: ['./administrador.component.css']
})
export class AdministradorComponent implements OnInit {

  users: users[] = [];
  cargando: boolean = false;
  email: string = '';
  password: string = '';
  nombre2: string = '';
  estado: string = '';
  tipo: string = '';

  // Usuario encontrado por búsqueda
  user: user | null = null;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private AuthService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.cargando = true;
    this.apiService.getUsers("Todos").subscribe({
      next: (data) => {
        this.users = data;
        this.cargando = false;
      },
      error: (error) => {
        console.error('❌ Error al cargar usuarios:', error);
        this.cargando = false;
      }
    });
  }
  agregarUsuario(name: string,mail:string,tipo:string, estado: string): void {

    this.apiService.createNewUser({ name, mail, tipo, estado }).subscribe({
      next: (data) => {
        console.log('✅ Usuario creado:', data);
        
        this.loadUsers(); // Recarga la lista de usuarios después de agregar uno nuevo
      },
      error: (error) => {
        console.error('❌ Error al crear usuario:', error);
      }
    }); 

  }
  async registrarUsuario() {

    try {
      await this.AuthService.register(this.email, this.password);
      const token = await this.AuthService.getIdToken();
      const body = { name: this.nombre2, email: this.email,  tipeUser: this.tipo, estadoUser: this.estado };
      this.apiService.syncUsers(body,token).subscribe({
        next: (data) => {
          console.log('✅ Usuarios sincronizados:', data);
          this.loadUsers(); // Recarga la lista de usuarios después de sincronizar
        },
        error: (error) => { 
          console.error('❌ Error al sincronizar usuarios:', error);
        }  
      });
      console.log('✅ Usuario registrado con éxito');
    } catch (error) {
      console.error('❌ Error al registrar usuario:', error);
    }
  }
  // 🔎 Buscar por nombre o por id
  buscar(userName: string, id: string): void {
    const nameTrim = userName.trim();
    const idTrim = id.trim();

    // Si no mandan nada, puedes recargar la lista completa
    if (!nameTrim && !idTrim) {
      this.user = null;
      this.loadUsers();
      return;
    }

    // 👉 Buscar por nombre
    if (nameTrim) {
      this.apiService.searchbyname(nameTrim).subscribe({
        next: (data) => {
          console.log('✅ Usuario por nombre:', data);
          this.user = data;
        },
        error: (error) => {
          console.error('❌ Error al buscar usuario por nombre:', error);
          this.user = null;
        }
      });
      return;
    }

    // 👉 Buscar por ID (si quieres usar el id)
    if (idTrim) {
      this.apiService.searchbyid(Number(idTrim)).subscribe({   // Asegúrate de tener este método en el ApiService
        next: (data) => {
          console.log('✅ Usuario por ID:', data);
          this.user = data;
        },
        error: (error) => {
          console.error('❌ Error al buscar usuario por ID:', error);
          this.user = null;
        }
      });
    }
  }

  // Botón cancelar: limpia el formulario de resultados
  cancelar(): void {
    this.user = null;
  }
  agregar(userName:string,id:number,name:string,tipo:string): void {
    // Aquí puedes navegar a una pantalla de "nuevo usuario"
    // o abrir un modal. Por ahora solo log:
    console.log('🟢 Click en Agregar');
    const newUser:users={
      idTweetUser:id,
      TweetUser:userName,
      nameUser:name,
      tipeUser:tipo
    };
    console.log(newUser);
    this.apiService.addUser(newUser).subscribe({
      next:(data)=>{
        console.log('✅ Usuario agregado:',data);
        this.loadUsers(); // Recarga la lista de usuarios después de agregar uno nuevo
      },
      error:(error)=>{
        console.error('❌ Error al agregar usuario:',error);
      }
    });   

    // this.router.navigate(['/nuevo-usuario']);
  }

}
