import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../services/api.service';
import { user } from '../interfaces/users';
import { users } from '../interfaces/users';
import { AuthService } from '../services/auth.service';
// ajusta la ruta a tu interfaz

type Plan = {
  id: number;
  name: string;
  duration_days: number;
  cost: string;
  is_active: number;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
};

type AppUser = {
  id: number;
  firebase_uid: string;
  email: string;
  display_name: string;
  role: string;
  estadoUser: string;
  created_at?: string;
  updated_at?: string;
};


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
  plans: Plan[] = [];
  appUsers: AppUser[] = [];

  selectedUserId: number | null = null;
  selectedPlanId: number | null = null;

  startDate: string = ''; // "YYYY-MM-DD"
  endDate: string = '';   // "YYYY-MM-DD"

  creatingSub = false;
  subMsg = '';

  // Usuario encontrado por búsqueda
  user: user | null = null;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private AuthService: AuthService
  ) {}

  ngOnInit(): void {
  this.loadUsers();      // tu lista actual (TweetUsers)
  this.loadPlans();      // NUEVO
  this.loadAppUsers();   // NUEVO

  // default fechas hoy
  const today = new Date();
  this.startDate = this.toDateInputValue(today);
}
  loadUsers(): void {
    this.cargando = true;
    this.apiService.getUsers("Todos").subscribe({
      next: (data) => {
        this.users = data;
        this.cargando = false;
      },
      error: (error) => {
        
        this.cargando = false;
      }
    });
  }
  loadPlans(): void {
  this.apiService.getPlans().subscribe({
    next: (data: Plan[]) => {
      // si quieres filtrar activos:
      this.plans = (data || []).filter(p => Number(p.is_active) === 1);
    },
    error: (err) => console.error('❌ Error al cargar planes:', err)
  });
}

loadAppUsers(): void {
  this.apiService.getAppUsers().subscribe({
    next: (data: AppUser[]) => {
      // opcional: solo activos
      this.appUsers = (data || []).filter(u => (u.estadoUser || '').toLowerCase() === 'activo');
    },
    error: (err) => console.error('❌ Error al cargar usuarios del sistema:', err)
  });
}
async crearSuscripcion(): Promise<void> {
  if (!this.canCreateSubscription()) return;

  try {
    this.creatingSub = true;
    this.subMsg = '';

    const token = await this.AuthService.getIdToken();

    const body = {
      user_id: this.selectedUserId,
      plan_id: this.selectedPlanId,
      start_date: this.startDate,
      end_date: this.endDate
    };

    this.apiService.createUserPlan(body, token).subscribe({
      next: (resp) => {
        
        this.subMsg = '✅ Suscripción creada correctamente.';
        this.creatingSub = false;

        // si luego muestras el estado de suscripción en UI, aquí recargas
        this.loadAppUsers();
      },
      error: (err) => {
        
        this.subMsg = '❌ No se pudo crear la suscripción.';
        this.creatingSub = false;
      }
    });
  } catch (e) {
    console.error('❌ Error token/flow:', e);
    this.subMsg = '❌ Error de autenticación.';
    this.creatingSub = false;
  }
}


  agregarUsuario(name: string,mail:string,tipo:string, estado: string): void {

    this.apiService.createNewUser({ name, mail, tipo, estado }).subscribe({
      next: (data) => {
       
        
        this.loadUsers(); // Recarga la lista de usuarios después de agregar uno nuevo
      },
      error: (error) => {
       
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
          
          this.loadUsers(); // Recarga la lista de usuarios después de sincronizar
        },
        error: (error) => { 
          
        }  
      });
      
    } catch (error) {
      
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
         
          this.user = data;
        },
        error: (error) => {
          
          this.user = null;
        }
      });
      return;
    }

    // 👉 Buscar por ID (si quieres usar el id)
    if (idTrim) {
      this.apiService.searchbyid(Number(idTrim)).subscribe({   // Asegúrate de tener este método en el ApiService
        next: (data) => {
          
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
  agregar(userName:string,id:string,name:string,tipo:string): void {
    // Aquí puedes navegar a una pantalla de "nuevo usuario"
    // o abrir un modal. Por ahora solo log:
    
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

  get selectedPlan(): Plan | null {
  if (!this.selectedPlanId) return null;
  return this.plans.find(p => p.id === this.selectedPlanId) || null;
}

onPlanChange(): void {
  this.recalcEndDate();
}

recalcEndDate(): void {
  const plan = this.selectedPlan;
  if (!plan || !this.startDate) {
    this.endDate = '';
    return;
  }

  const start = new Date(this.startDate + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + Number(plan.duration_days));

  this.endDate = this.toDateInputValue(end);
}

toDateInputValue(d: Date): string {
  // YYYY-MM-DD
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

canCreateSubscription(): boolean {
  return !!(this.selectedUserId && this.selectedPlanId && this.startDate && this.endDate);
}

resetPlanForm(): void {
  this.selectedUserId = null;
  this.selectedPlanId = null;
  const today = new Date();
  this.startDate = this.toDateInputValue(today);
  this.endDate = '';
  this.subMsg = '';
}


}
