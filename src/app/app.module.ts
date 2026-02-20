import { NgModule } from '@angular/core';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';
import { RouterModule,Routes} from '@angular/router';
import { HttpClient, HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MenuComponent } from './menu/menu.component';
import { PoliticaComponent } from './politica/politica.component';
import { ResumenComponent } from './resumen/resumen.component';
import { EconomiaComponent } from './economia/economia.component';
import { SeguridadComponent } from './seguridad/seguridad.component';
import { EstadisticasComponent } from './estadisticas/estadisticas.component';
import { MatDatepickerModule } from '@angular/material/datepicker'
import { MatInputModule } from '@angular/material/input'
import { MatNativeDateModule } from '@angular/material/core'
import { FormsModule } from '@angular/forms' 
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { MatFormFieldModule} from '@angular/material/form-field';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { DeportesComponent } from './deportes/deportes.component';
import { SocialComponent } from './social/social.component'
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
import { GestionesComponent } from './gestiones/gestiones.component';
import { SaludComponent } from './salud/salud.component';
import path from 'path';
import { LoginComponent } from './login/login.component';
import { EducacionComponent } from './educacion/educacion.component';
import { OtrosComponent } from './otros/otros.component';
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
import { AmbienteComponent } from './ambiente/ambiente.component';
import { PerfilComponent } from './perfil/perfil.component';
import { SubscriptionInterceptor } from './core/interceptor/subscription.interceptor';
import { SubscriptionGuard } from './core/guards/subscription.guard';


// Initialize Firebase


const routes: Routes = [
  { path: '', component: PrincipalComponent, canActivate: [AuthGuard] },
  { path: 'politica', component: PoliticaComponent, canActivate: [AuthGuard, SubscriptionGuard], data: { subscriptionRequired: true } },
  { path: 'economia', component: EconomiaComponent, canActivate: [AuthGuard, SubscriptionGuard], data: { subscriptionRequired: true } },
  { path: 'resumen',  component: ResumenComponent},
  { path: 'seguridad',  component: SeguridadComponent, canActivate: [AuthGuard, SubscriptionGuard], data: { subscriptionRequired: true } },
  { path: 'estadisticas', component:EstadisticasComponent, canActivate: [AuthGuard, SubscriptionGuard], data: { subscriptionRequired: true } },
  { path: 'deportes', component:DeportesComponent, canActivate: [AuthGuard, SubscriptionGuard], data: { subscriptionRequired: true } },
  { path: 'social', component:SocialComponent, canActivate: [AuthGuard, SubscriptionGuard], data: { subscriptionRequired: true } },
  { path: 'ambiente', component:AmbienteComponent, canActivate: [AuthGuard, SubscriptionGuard], data: { subscriptionRequired: true } },
  { path: 'administrador', component:AdministradorComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['admin']},},
  { path: 'personas', component:PersonasComponent, canActivate: [AuthGuard, SubscriptionGuard], data: { subscriptionRequired: true } },
  { path: 'salud', component:SaludComponent, canActivate: [AuthGuard, SubscriptionGuard], data: { subscriptionRequired: true } },
  { path: 'educacion', component:EducacionComponent, canActivate: [AuthGuard, SubscriptionGuard], data: { subscriptionRequired: true } },
  { path: 'otros', component:OtrosComponent, canActivate: [AuthGuard, SubscriptionGuard], data: { subscriptionRequired: true } },
  { path: 'gestiones', component:GestionesComponent, canActivate: [AuthGuard, SubscriptionGuard], data: { subscriptionRequired: true } },
  { path: 'login', component:LoginComponent},
  { path: 'entidades', component:EntidadesComponent, canActivate: [AuthGuard, SubscriptionGuard], data: { subscriptionRequired: true } },
  { path: 'catSelect',component:CatSelectComponent, canActivate: [AuthGuard, SubscriptionGuard], data: { roles:["admin"] } },
  { path: 'account', component:PerfilComponent},
  { path:'perfil', component:PerfilComponent, canActivate:[AuthGuard]},
  


  
];

@NgModule({
  declarations: [
    AppComponent,
    MenuComponent,
    PoliticaComponent,
    ResumenComponent,
    EconomiaComponent,
    SeguridadComponent,
    EstadisticasComponent,
    DeportesComponent,
    SocialComponent,
    TodosComponent,
    PoliticaEstadisticasComponent,
    PrincipalComponent,
    AdministradorComponent,
    PersonasComponent,
    GestionesComponent,
    SaludComponent,
    LoginComponent,
    EducacionComponent,
    OtrosComponent,
    EntidadesComponent,
    CatSelectComponent,
    EstadisticasEntiPersonasComponent,
    AmbienteComponent,
    PerfilComponent,
    
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
    MatTooltipModule


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
