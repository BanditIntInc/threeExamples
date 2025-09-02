import { logger } from '../../../utils/logger';

interface LotteryDrawData {
    draw_date: string;
    winning_numbers: string;
    multiplier: string;
}

interface NumberFrequency {
    number: number;
    count: number;
    isRedBall: boolean; // true if this is a Powerball number
}

export class LotteryAnalyzer {
    private whiteballFrequencies: Map<number, number> = new Map();
    private powerballFrequencies: Map<number, number> = new Map();
    
    public analyzeData(lotteryData: LotteryDrawData[]): void {
        // Clear previous analysis
        this.whiteballFrequencies.clear();
        this.powerballFrequencies.clear();
        
        // Analyze each draw
        lotteryData.forEach(draw => {
            const numbers = this.parseWinningNumbers(draw.winning_numbers);
            
            if (numbers.length >= 6) {
                // First 5 numbers are white balls
                const whiteBalls = numbers.slice(0, 5);
                whiteBalls.forEach(num => {
                    this.whiteballFrequencies.set(num, (this.whiteballFrequencies.get(num) || 0) + 1);
                });
                
                // Last number is the Powerball (red ball)
                const powerball = numbers[5];
                if (powerball !== undefined) {
                    this.powerballFrequencies.set(powerball, (this.powerballFrequencies.get(powerball) || 0) + 1);
                }
            }
        });
        
        logger.info(`Analyzed ${lotteryData.length} lottery draws`, 'LotteryAnalyzer');
        logger.debug(`White ball frequencies: ${this.whiteballFrequencies}`, 'LotteryAnalyzer');
        logger.debug(`Powerball frequencies: ${this.powerballFrequencies}`, 'LotteryAnalyzer');
    }
    
    private parseWinningNumbers(winningNumbersString: string): number[] {
        return winningNumbersString
            .split(' ')
            .map(num => parseInt(num.trim()))
            .filter(num => !isNaN(num));
    }
    
    public getFrequencyForNumber(number: number, isRedBall: boolean = false): number {
        if (isRedBall) {
            return this.powerballFrequencies.get(number) || 0;
        } else {
            return this.whiteballFrequencies.get(number) || 0;
        }
    }
    
    public getAllWhiteBallFrequencies(): NumberFrequency[] {
        const frequencies: NumberFrequency[] = [];
        
        this.whiteballFrequencies.forEach((count, number) => {
            frequencies.push({ number, count, isRedBall: false });
        });
        
        return frequencies.sort((a, b) => b.count - a.count); // Sort by frequency, highest first
    }
    
    public getAllPowerballFrequencies(): NumberFrequency[] {
        const frequencies: NumberFrequency[] = [];
        
        this.powerballFrequencies.forEach((count, number) => {
            frequencies.push({ number, count, isRedBall: true });
        });
        
        return frequencies.sort((a, b) => b.count - a.count); // Sort by frequency, highest first
    }
    
    public getTopNumbers(count: number, isRedBall: boolean = false): NumberFrequency[] {
        if (isRedBall) {
            return this.getAllPowerballFrequencies().slice(0, count);
        } else {
            return this.getAllWhiteBallFrequencies().slice(0, count);
        }
    }
    
    public async fetchHistoricalData(limit: number = 100): Promise<LotteryDrawData[]> {
        try {
            const response = await fetch(`https://data.ny.gov/resource/d6yy-54nr.json?$order=draw_date DESC&$limit=${limit}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data: LotteryDrawData[] = await response.json();
            logger.info(`Fetched ${data.length} historical lottery draws`, 'LotteryAnalyzer');
            return data;
        } catch (error) {
            logger.error(`Error fetching historical lottery data: ${error}`, 'LotteryAnalyzer');
            return [];
        }
    }
}