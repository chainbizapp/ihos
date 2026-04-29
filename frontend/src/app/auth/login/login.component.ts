import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  template: `
    <div class="min-h-screen bg-[#f4f6fa] flex flex-col items-center justify-center py-10 px-4 sm:px-6 lg:px-8 font-['Be_Vietnam_Pro'] relative overflow-hidden">
      <!-- Main Card -->
      <div class="w-full max-w-[1100px] bg-white rounded-[40px] shadow-2xl flex flex-col md:flex-row overflow-hidden min-h-[700px] z-10 relative">
        
        <!-- Left Pane (Teal area) -->
        <div class="hidden md:flex md:w-[48%] bg-[#006874] bg-gradient-to-br from-[#005a64] to-[#3695a1] p-12 lg:p-14 text-white flex-col relative overflow-hidden shrink-0">
          
          <!-- Logo -->
          <div class="text-2xl font-bold tracking-tight mb-16 relative z-10 font-sans cursor-default">
            InsureHub
          </div>
          
          <div class="relative z-10 flex-grow pt-4">
            <h1 class="text-[52px] lg:text-[56px] font-[800] mb-6 leading-[1.05] font-['Plus_Jakarta_Sans'] tracking-tight">
              Simplify Your<br/>Quotations.
            </h1>
            <p class="text-base lg:text-lg text-white/90 leading-relaxed font-medium max-w-[22rem] pr-2">
              Streamline the way you find, compare, and generate motor insurance plans for your clients.
            </p>
          </div>

          <!-- Overlapping avatars at bottom -->
          <div class="relative z-10 mt-auto pt-16 flex flex-col items-start gap-4">
            <div class="flex -space-x-3">
              <img class="w-11 h-11 rounded-full border-2 border-[#006874] object-cover" src="https://i.pravatar.cc/100?img=1" alt="User 1">
              <img class="w-11 h-11 rounded-full border-2 border-[#006874] object-cover" src="https://i.pravatar.cc/100?img=11" alt="User 2">
              <div class="w-11 h-11 rounded-full border-2 border-[#006874] bg-[#f7941d] flex items-center justify-center text-xs font-[800] text-white z-10 font-['Plus_Jakarta_Sans']">
                +12k
              </div>
            </div>
            <p class="text-[13px] font-medium text-white/80 italic">
              Trusted by leading insurance brokers and agencies worldwide.
            </p>
          </div>
          
          <!-- Decorative curve -->
          <div class="absolute -bottom-24 left-0 right-0 h-48 bg-gradient-to-t from-white/15 to-transparent pointer-events-none transform scale-150 rounded-[100%] opacity-80" style="border-radius: 100% 100% 0 0 / 100% 100% 0 0;"></div>
        </div>

        <!-- Right Pane (White Form area) -->
        <div class="md:w-[52%] p-10 md:p-14 lg:p-16 flex flex-col justify-center">
          
          <div class="max-w-[400px] w-full mx-auto">
            <div class="mb-10">
              <h2 class="text-[34px] font-bold text-gray-900 tracking-tight font-['Plus_Jakarta_Sans'] mb-2">Welcome Back</h2>
              <p class="text-gray-500 font-medium text-[15px]">Continue your creative journey with InsureHub.</p>
            </div>

            <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-5">
              
              <!-- Email -->
              <div>
                <label class="block text-[13px] font-bold text-gray-700 mb-2 font-['Inter']">Email Address</label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg class="h-[22px] w-[22px] text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input type="email" formControlName="email" class="block w-full pl-[46px] pr-3 py-3.5 border-0 bg-[#f0f2f5] rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#006874] text-[15px] font-medium transition-all" placeholder="name@agency.com">
                </div>
                @if (form.get('email')?.hasError('required') && form.get('email')?.touched) {
                  <p class="mt-2 text-xs text-red-600 font-semibold font-['Inter']">Email is required</p>
                }
              </div>

              <!-- Password -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="block text-[13px] font-bold text-gray-700 font-['Inter']">Password</label>
                  <a href="javascript:void(0)" class="text-[12px] font-[800] text-[#b57426] hover:text-[#8c4f00] font-['Inter'] transition-colors">Forgot Password?</a>
                </div>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input [type]="showPassword() ? 'text' : 'password'" formControlName="password" class="block w-full pl-[46px] pr-10 py-3.5 border-0 bg-[#f0f2f5] rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#006874] text-[15px] font-medium tracking-wide transition-all" placeholder="••••••••">
                  <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button type="button" (click)="togglePasswordVisibility()" class="text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 p-1 transition-colors">
                      @if (showPassword()) {
                        <svg class="h-[20px] w-[20px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      } @else {
                        <svg class="h-[20px] w-[20px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      }
                    </button>
                  </div>
                </div>
                @if (form.get('password')?.hasError('required') && form.get('password')?.touched) {
                  <p class="mt-2 text-xs text-red-600 font-semibold font-['Inter']">Password is required</p>
                }
              </div>

              <!-- Remember Me -->
              <div class="flex items-center mt-1">
                <input id="remember-me" name="remember-me" type="checkbox" class="h-4 w-4 text-[#006874] focus:ring-[#006874] border-gray-300 rounded cursor-pointer transition-colors">
                <label for="remember-me" class="ml-3 block text-[13px] text-gray-700 font-bold cursor-pointer font-['Inter']">
                  Remember this device
                </label>
              </div>

              <!-- Error Alert -->
              @if (errorMessage()) {
                <div class="rounded-xl bg-red-50 p-4 border border-red-100">
                  <div class="flex items-center">
                    <svg class="h-5 w-5 text-red-500 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p class="text-sm font-medium text-red-800">{{ errorMessage() }}</p>
                  </div>
                </div>
              }

              <!-- Submit Button -->
              <button type="submit" [disabled]="loading()" class="w-full flex justify-center items-center py-3.5 px-4 mt-2 border border-transparent rounded-[18px] shadow-md text-[15px] font-bold text-white bg-[#338e9a] hover:bg-[#207c87] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#006874] transition-all disabled:opacity-75 font-['Plus_Jakarta_Sans'] tracking-wide">
                @if (loading()) {
                  <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                }
                Sign In
              </button>
              
            </form>

            <!-- Divider -->
            <div class="mt-8">
              <div class="relative">
                <div class="absolute inset-0 flex items-center">
                  <div class="w-full border-t border-gray-200"></div>
                </div>
                <div class="relative flex justify-center text-sm">
                  <span class="px-4 bg-white text-gray-500 font-bold text-[13px] font-['Inter']">Or continue with</span>
                </div>
              </div>

              <!-- Social Buttons -->
              <div class="mt-6 flex gap-4">
                <a href="javascript:void(0)" class="w-full inline-flex justify-center items-center py-3 border border-transparent rounded-[14px] bg-[#f0f2f5] text-[14px] font-[800] text-[#1c1c1c] hover:bg-[#e4e6ea] focus:outline-none transition-colors font-['Plus_Jakarta_Sans']">
                  <svg class="h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google
                </a>
                
                <a href="javascript:void(0)" class="w-full inline-flex justify-center items-center py-3 border border-transparent rounded-[14px] bg-[#f0f2f5] text-[14px] font-[800] text-[#1c1c1c] hover:bg-[#e4e6ea] focus:outline-none transition-colors font-['Plus_Jakarta_Sans']">
                  <svg class="h-4 w-4 mr-2" viewBox="0 0 21 21" fill="none">
                    <path d="M10 0H0V10H10V0Z" fill="#F25022"/>
                    <path d="M21 0H11V10H21V0Z" fill="#7FBA00"/>
                    <path d="M10 11H0V21H10V11Z" fill="#00A4EF"/>
                    <path d="M21 11H11V21H21V11Z" fill="#FFB900"/>
                  </svg>
                  Microsoft
                </a>
              </div>
            </div>

            <p class="mt-8 text-center text-[14px] font-[700] text-[#1c1c1c] font-['Plus_Jakarta_Sans']">
              New to InsureHub? <a routerLink="/auth/register" class="text-[#006874] hover:text-[#005a63] cursor-pointer pl-1">Create an Account</a>
            </p>

          </div>
        </div>
      </div>

      <!-- Bottom Page Footer Layout -->
      <div class="w-full max-w-[1100px] mt-8 flex flex-col sm:flex-row justify-between items-center text-[13px] text-gray-500 font-medium font-['Inter'] px-4 lg:px-0">
        <div class="flex items-center gap-1.5 mb-4 sm:mb-0">
          <span class="text-[#006874] font-bold text-[14px] font-['Plus_Jakarta_Sans'] tracking-tight">InsureHub</span>
          <span>© 2024 InsureHubCopywriting. All rights reserved.</span>
        </div>
        <div class="flex gap-6">
          <a href="javascript:void(0)" class="hover:text-gray-900 transition-colors">Privacy Policy</a>
          <a href="javascript:void(0)" class="hover:text-gray-900 transition-colors">Terms of Service</a>
          <a href="javascript:void(0)" class="hover:text-gray-900 transition-colors">Support</a>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly showPassword = signal(false);

  togglePasswordVisibility(): void {
    this.showPassword.update(s => !s);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    try {
      await this.auth.login(
        this.form.value.email!,
        this.form.value.password!
      );
      await this.router.navigate(['/search']);
    } catch (err: any) {
      const msg = err?.error?.error ?? err?.message ?? 'Login failed. Please try again.';
      this.errorMessage.set(msg);
    } finally {
      this.loading.set(false);
    }
  }
}
