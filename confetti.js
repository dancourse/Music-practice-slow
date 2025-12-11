// Simple confetti animation
class Confetti {
    constructor() {
        this.canvas = document.getElementById('confettiCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.animationFrame = null;

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createParticle() {
        return {
            x: Math.random() * this.canvas.width,
            y: -10,
            size: Math.random() * 8 + 4,
            speedY: Math.random() * 3 + 2,
            speedX: Math.random() * 4 - 2,
            color: this.getRandomColor(),
            rotation: Math.random() * 360,
            rotationSpeed: Math.random() * 10 - 5
        };
    }

    getRandomColor() {
        const colors = [
            '#6366f1', // primary
            '#8b5cf6', // secondary
            '#10b981', // green
            '#f59e0b', // orange
            '#ef4444', // red
            '#3b82f6', // blue
            '#ec4899', // pink
            '#14b8a6'  // teal
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    burst() {
        // Create 50 particles
        for (let i = 0; i < 50; i++) {
            this.particles.push(this.createParticle());
        }

        // Start animation if not already running
        if (!this.animationFrame) {
            this.animate();
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update and draw particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            // Update position
            p.y += p.speedY;
            p.x += p.speedX;
            p.rotation += p.rotationSpeed;
            p.speedY += 0.1; // gravity

            // Draw particle
            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate((p.rotation * Math.PI) / 180);
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            this.ctx.restore();

            // Remove if off screen
            if (p.y > this.canvas.height + 10) {
                this.particles.splice(i, 1);
            }
        }

        // Continue animation if particles exist
        if (this.particles.length > 0) {
            this.animationFrame = requestAnimationFrame(() => this.animate());
        } else {
            this.animationFrame = null;
        }
    }
}

// Initialize confetti
let confetti;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        confetti = new Confetti();
    });
} else {
    confetti = new Confetti();
}
