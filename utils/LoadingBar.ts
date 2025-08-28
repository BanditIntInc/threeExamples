/**
 * Reusable loading bar component with progress tracking
 */
export class LoadingBar {
    private loadingElement: HTMLElement | null = null;
    private progressBarElement: HTMLElement | null = null;
    private progressTextElement: HTMLElement | null = null;
    private progress: number = 0;
    private message: string;

    constructor(message: string = 'Loading...') {
        this.message = message;
        this.create();
    }

    private create(): void {
        this.loadingElement = document.createElement('div');
        this.loadingElement.style.position = 'fixed';
        this.loadingElement.style.top = '50%';
        this.loadingElement.style.left = '50%';
        this.loadingElement.style.transform = 'translate(-50%, -50%)';
        this.loadingElement.style.color = 'white';
        this.loadingElement.style.fontSize = '24px';
        this.loadingElement.style.fontFamily = 'Arial, sans-serif';
        this.loadingElement.style.textAlign = 'center';
        this.loadingElement.style.zIndex = '1000';
        this.loadingElement.style.background = 'rgba(0, 0, 0, 0.8)';
        this.loadingElement.style.padding = '20px';
        this.loadingElement.style.borderRadius = '10px';
        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.textContent = this.message;
        
        // Create progress bar container
        const progressContainer = document.createElement('div');
        progressContainer.style.marginTop = '10px';
        progressContainer.style.width = '300px';
        progressContainer.style.height = '20px';
        progressContainer.style.background = '#333';
        progressContainer.style.borderRadius = '10px';
        progressContainer.style.overflow = 'hidden';
        
        // Create progress bar
        this.progressBarElement = document.createElement('div');
        this.progressBarElement.style.width = '0%';
        this.progressBarElement.style.height = '100%';
        this.progressBarElement.style.background = 'linear-gradient(0deg, #0066cc, #00aaff)';
        this.progressBarElement.style.transition = 'width 0.3s';
        
        // Create progress text
        this.progressTextElement = document.createElement('div');
        this.progressTextElement.style.marginTop = '10px';
        this.progressTextElement.style.fontSize = '16px';
        this.progressTextElement.textContent = '0%';
        
        // Assemble elements
        progressContainer.appendChild(this.progressBarElement);
        this.loadingElement.appendChild(messageDiv);
        this.loadingElement.appendChild(progressContainer);
        this.loadingElement.appendChild(this.progressTextElement);
        
        document.body.appendChild(this.loadingElement);
    }

    public updateProgress(progress: number): void {
        this.progress = progress;
        
        if (this.progressBarElement) {
            this.progressBarElement.style.width = `${progress}%`;
        }
        
        if (this.progressTextElement) {
            this.progressTextElement.textContent = `${Math.round(progress)}%`;
        }
    }

    public hide(): void {
        if (this.loadingElement) {
            this.loadingElement.style.opacity = '0';
            this.loadingElement.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                if (this.loadingElement) {
                    document.body.removeChild(this.loadingElement);
                    this.loadingElement = null;
                }
            }, 500);
        }
    }

    public setMessage(message: string): void {
        this.message = message;
        if (this.loadingElement) {
            const messageElement = this.loadingElement.querySelector('div');
            if (messageElement) {
                messageElement.textContent = message;
            }
        }
    }

    public showError(errorMessage: string): void {
        if (this.loadingElement) {
            this.loadingElement.innerHTML = `
                <div style="color: #ff6b6b;">${errorMessage}</div>
                <div style="margin-top: 10px; font-size: 16px;">Please try again or check the console for more details.</div>
            `;
        }
    }

    public dispose(): void {
        if (this.loadingElement) {
            document.body.removeChild(this.loadingElement);
            this.loadingElement = null;
        }
    }
}