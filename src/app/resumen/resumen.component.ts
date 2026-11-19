import { Component, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { JsonData } from '../interfaces/JsonData';
import { ApiService } from '../services/api.service';
import { ResumeInterface } from '../interfaces/ResumeInterface';

@Component({
  selector: 'app-resumen',
  templateUrl: './resumen.component.html',
  styleUrl: './resumen.component.css'
})
export class ResumenComponent implements OnInit {
  dato?: JsonData;
  resumen?: ResumeInterface;
  isLoading = false;
  error = '';

  constructor(
    private router: Router,
    private location: Location,
    private apiService: ApiService,
    private destroyRef: DestroyRef
  ) {}

  ngOnInit(): void {
    const state = this.router.getCurrentNavigation()?.extras.state ?? this.location.getState();
    this.dato = (state as { datos?: JsonData } | null)?.datos;
    const url = this.dato?.url_web?.trim();
    if (!url) return;

    this.isLoading = true;
    this.apiService.getResumen({ url }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: response => {
        this.resumen = response[0];
        this.isLoading = false;
      },
      error: () => {
        this.error = 'No se pudo cargar el resumen.';
        this.isLoading = false;
      }
    });
  }

  goBack(): void {
    void this.router.navigate(['/']);
  }
}
