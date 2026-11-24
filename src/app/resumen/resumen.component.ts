import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { JsonData } from '../interfaces/JsonData';

@Component({
  selector: 'app-resumen',
  templateUrl: './resumen.component.html',
  styleUrl: './resumen.component.css'
})
export class ResumenComponent implements OnInit {
  dato?: JsonData;

  constructor(
    private router: Router,
    private location: Location
  ) {}

  ngOnInit(): void {
    const state = this.router.getCurrentNavigation()?.extras.state ?? this.location.getState();
    this.dato = (state as { datos?: JsonData } | null)?.datos;
  }

  goBack(): void {
    void this.router.navigate(['/']);
  }
}
