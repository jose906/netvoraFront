import { NgModule } from '@angular/core';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';
import { RouterModule,Routes} from '@angular/router';
import { HttpClient, HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MenuComponent } from './menu/menu.component';
import { ResumenComponent } from './resumen/resumen.component';
import { EstadisticasComponent } from './estadisticas/estadisticas.component';
import { MatDatepickerModule } from '@angular/material/datepicker'
import { MatInputModule } from '@angular/material/input'
import { MatNativeDateModule } from '@angular/material/core'
import { FormsModule } from '@angular/forms' 
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { MatFormFieldModule} from '@angular/material/form-field';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { TodosComponent } from './data/todos/todos.component';
import { PoliticaEstadisticasComponent } from './data/politica-estadisticas/politica-estadisticas.component';
import {NgChartsModule} from 'ng2-charts'
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';


import { PrincipalComponent } from './principal/principal.component';
import { AdministradorComponent } from './administrador/administrador.component';
import { PersonasComponent } from './personas/personas.component';
import path from 'path';
import { LoginComponent } from './login/login.component';
import { environment } from '../environments/environment';
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { getAuth,provideAuth } from '@angular/fire/auth';
import { AuthInterceptor } from "./core/interceptor/auth.interceptor";
import { AuthGuard } from './core/guards/auth.guard';
import { provideFirebaseApp } from '@angular/fire/app';
import { EntidadesComponent } from './entidades/entidades.component';
import { CatSelectComponent } from './cat-select/cat-select.component';
import { RoleGuard } from './core/guards/role.guard';
import { EstadisticasEntiPersonasComponent } from './data/estadisticas-enti-personas/estadisticas-enti-personas.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PerfilComponent } from './perfil/perfil.component';
import { SubscriptionInterceptor } from './core/interceptor/subscription.interceptor';
import { SubscriptionGuard } from './core/guards/subscription.guard';
import { GuardarComponent } from './guardar/guardar.component';
import { SettingsComponent } from './settings/settings.component';
import { TopicsComponent } from './topics/topics.component';
import { CategoriaComponent } from './categoria/categoria.component';


// Initialize Firebase


const routes: Routes = [
  { path: '', component: PrincipalComponent, canActivate: [AuthGuard],data: { subscriptionRequired: true } },
  { path: 'politica', component: CategoriaComponent, canActivate: [AuthGuard], data:{categoria: 'Politica',categoriaLabel: 'Política',categoriaPath: 'politica'} },
  { path: 'economia', component: CategoriaComponent, canActivate: [AuthGuard], data:{categoria: 'Economia',categoriaLabel: 'Economía',categoriaPath: 'economia'} },
  { path: 'resumen',  component: ResumenComponent},
  { path: 'seguridad',  component: CategoriaComponent, canActivate: [AuthGuard], data:{categoria: 'Seguridad',categoriaLabel: 'Seguridad',categoriaPath: 'seguridad'} },
  { path: 'estadisticas', component:EstadisticasComponent, canActivate: [AuthGuard] },
  { path: 'deportes', component:CategoriaComponent, canActivate: [AuthGuard], data: { subscriptionRequired: true, categoria: 'Deportes', categoriaLabel: 'Deportes', categoriaPath: 'deportes' }, },
  { path: 'social', component:CategoriaComponent, canActivate: [AuthGuard], data: { subscriptionRequired: true, categoria: 'Social', categoriaLabel: 'Social', categoriaPath: 'social' } },
  { path: 'ambiente', component:CategoriaComponent, canActivate: [AuthGuard], data: { subscriptionRequired: true, categoria: 'Ambiente', categoriaLabel: 'Ambiente', categoriaPath: 'ambiente' } },
  { path: 'administrador', component:AdministradorComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['admin']},},
  { path: 'personas', component:PersonasComponent, canActivate: [AuthGuard], data: { subscriptionRequired: true } },
  { path: 'salud', component:CategoriaComponent, canActivate: [AuthGuard], data: { subscriptionRequired: true, categoria: 'Salud', categoriaLabel: 'Salud', categoriaPath: 'salud' } },
  { path: 'educacion', component:CategoriaComponent, canActivate: [AuthGuard], data: { subscriptionRequired: true, categoria: 'Educacion', categoriaLabel: 'Educación', categoriaPath: 'educacion' } },
  { path: 'otros', component:CategoriaComponent, canActivate: [AuthGuard], data: { subscriptionRequired: true, categoria: 'Otros', categoriaLabel: 'Otros', categoriaPath: 'otros' } },
  { path: 'gestiones', component:CategoriaComponent, canActivate: [AuthGuard], data: { subscriptionRequired: true, categoria: 'Gestiones', categoriaLabel: 'Gestiones', categoriaPath: 'gestiones' } },
  { path: 'login', component:LoginComponent},
  { path: 'entidades', component:EntidadesComponent, canActivate: [AuthGuard], data: { subscriptionRequired: true } },
  { path: 'catSelect',component:CatSelectComponent, canActivate: [AuthGuard], data: { roles:["admin"] } },
  { path: 'account', component:PerfilComponent},
  { path:'perfil', component:PerfilComponent, canActivate:[AuthGuard]},
  { path: 'guardar', component: GuardarComponent, canActivate: [AuthGuard], data: { subscriptionRequired: true } },
  { path: 'settings', component: SettingsComponent, canActivate: [AuthGuard], data: { subscriptionRequired: true } },
  { path: 'topics/:id', component: TopicsComponent, canActivate: [AuthGuard], data: { subscriptionRequired: true } },
  { path: 'topics', component: TopicsComponent, canActivate: [AuthGuard], data: { subscriptionRequired: true } }
  


  
];

@NgModule({
  declarations: [
    AppComponent,
    MenuComponent,
    ResumenComponent,

    EstadisticasComponent,
  
    TodosComponent,
    PoliticaEstadisticasComponent,
    PrincipalComponent,
    AdministradorComponent,
    PersonasComponent,

    LoginComponent,
    EntidadesComponent,
    CatSelectComponent,
    EstadisticasEntiPersonasComponent,
    PerfilComponent,
    GuardarComponent,
    SettingsComponent,
    TopicsComponent,
    CategoriaComponent,
    
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    RouterModule.forRoot(routes),
    HttpClientModule,
    MatDatepickerModule,
    MatInputModule,
    MatNativeDateModule,
    FormsModule,
    BrowserAnimationsModule, 
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    NgChartsModule,
    MatSelectModule,
    MatCardModule, 
    AngularFireModule.initializeApp(environment.firebase),
   AngularFireAuthModule,
    AngularFireAuthModule, 
    MatTooltipModule,
    


  ],
  providers: [
    provideClientHydration(),
    provideAnimationsAsync(),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: SubscriptionInterceptor, multi: true },

  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
