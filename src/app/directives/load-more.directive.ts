import { AfterViewInit, Directive, ElementRef, EventEmitter, OnDestroy, Output } from '@angular/core';

@Directive({
  selector: '[appLoadMore]',
  standalone: true,
  host: { style: 'display: block; min-height: 1px' }
})
export class LoadMoreDirective implements AfterViewInit, OnDestroy {
  @Output() appLoadMore = new EventEmitter<void>();
  private observer?: IntersectionObserver;

  constructor(private element: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    if (typeof IntersectionObserver === 'undefined') return;

    this.observer = new IntersectionObserver(entries => {
      if (this.observer && entries.some(entry => entry.isIntersecting)) {
        this.appLoadMore.emit();
      }
    }, { rootMargin: '0px 0px 240px 0px' });
    this.observer.observe(this.element.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = undefined;
  }
}
