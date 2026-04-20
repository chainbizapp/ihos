import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <mat-card class="w-full max-w-md">
        <mat-card-header>
          <mat-card-title class="text-2xl font-bold text-center w-full">Request Access</mat-card-title>
        </mat-card-header>
        <mat-card-content class="mt-4">
          @if (submitted()) {
            <div class="text-center py-8">
              <p class="text-green-700 font-medium text-lg">Registration submitted!</p>
              <p class="text-gray-600 mt-2">Your account is pending approval by a manager.</p>
              <p class="text-gray-600">You will be notified once your account is approved.</p>
              <a routerLink="/auth/login" class="text-blue-600 hover:underline mt-4 inline-block">Back to login</a>
            </div>
          } @else {
            <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-4">
              <mat-form-field>
                <mat-label>Full Name</mat-label>
                <input matInput formControlName="fullName" autocomplete="name" />
                @if (form.get('fullName')?.hasError('required') && form.get('fullName')?.touched) {
                  <mat-error>Full name is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field>
                <mat-label>Email</mat-label>
                <input matInput type="email" formControlName="email" autocomplete="email" />
                @if (form.get('email')?.hasError('required') && form.get('email')?.touched) {
                  <mat-error>Email is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field>
                <mat-label>Password</mat-label>
                <input matInput type="password" formControlName="password" autocomplete="new-password" />
                @if (form.get('password')?.hasError('minlength')) {
                  <mat-error>Password must be at least 8 characters</mat-error>
                }
              </mat-form-field>

              @if (errorMessage()) {
                <div class="text-red-600 text-sm p-2 bg-red-50 rounded">{{ errorMessage() }}</div>
              }

              <button mat-raised-button color="primary" type="submit" [disabled]="loading()">
                @if (loading()) {
                  <mat-spinner diameter="20" class="inline-block mr-2" />
                }
                Submit Request
              </button>

              <a routerLink="/auth/login" class="text-sm text-center text-blue-600 hover:underline">
                Back to login
              </a>
            </form>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `
})
export class RegisterComponent {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly submitted = signal(false);

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/auth/register`, this.form.value)
      );
      this.submitted.set(true);
    } catch (err: any) {
      this.errorMessage.set(err?.error?.message ?? 'Registration failed. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
